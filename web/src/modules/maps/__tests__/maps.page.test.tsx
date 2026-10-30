// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { NetBlockedError } from '@/core/net/netlog';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { clearTileCache } from '../tiles';
import { placeRepo, routeRepo } from '../repo';
import MapsPage from '../routes/MapsPage';

const requests: string[] = [];
const hostOf = (url: string): string => new URL(url).host;
let blockTiles = false;
let routingAnswer: { status: number; body: unknown } = { status: 200, body: {} };
const OSRM_OK = {
  code: 'Ok',
  routes: [
    {
      distance: 3400,
      duration: 1260,
      geometry: {
        coordinates: [
          [11.0044, 49.5981],
          [11.015, 49.585],
          [11.0257, 49.5712],
        ],
      },
      legs: [
        {
          steps: [
            { distance: 900, duration: 300, name: 'Hauptstraße', maneuver: { type: 'depart' } },
            {
              distance: 2500,
              duration: 960,
              name: 'Ringweg',
              maneuver: { type: 'turn', modifier: 'left' },
            },
            { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive' } },
          ],
        },
      ],
    },
  ],
};

function install() {
  const web = createWebPlatform();
  const platform: PlatformService = {
    ...web,
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input);
      requests.push(url);
      if (hostOf(url) === 'nominatim.openstreetmap.org') {
        return new Response(
          JSON.stringify([
            {
              display_name: 'Schlossplatz, Erlangen, Bayern, Deutschland',
              lat: '49.5981',
              lon: '11.0044',
            },
            { display_name: 'Schlossplatz, Stuttgart', lat: '48.7785', lon: '9.1800' },
          ]),
          { status: 200 },
        );
      }
      if (hostOf(url) === 'routing.openstreetmap.de') {
        if (blockTiles) throw new NetBlockedError();
        return new Response(JSON.stringify(routingAnswer.body), { status: routingAnswer.status });
      }
      if (blockTiles) throw new NetBlockedError();
      return new Response('png', { status: 200, headers: { 'content-type': 'image/png' } });
    }) as typeof fetch,
  };
  setPlatform(platform);
}

const open = (url = '/maps') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <MapsPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  requests.length = 0;
  blockTiles = false;
  routingAnswer = { status: 200, body: OSRM_OK };
  let n = 0;
  URL.createObjectURL = () => `blob:t${++n}`;
  URL.revokeObjectURL = () => undefined;
  clearTileCache();
  install();
  await db.table('maps_place').clear();
  await db.table('maps_route').clear();
});
afterEach(() => {
  cleanup();
  setPlatform(undefined);
});

const place = (name: string, lat: number, lon: number) =>
  placeRepo.create({ name, lat, lon, category: 'other', pinned: false });

describe('Karten & Orte page', () => {
  it('opens on the lists: nothing is requested, empty states offer the next step', async () => {
    open();
    expect(await screen.findByText('Noch keine Orte.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ort hinzufügen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Routen' }));
    expect(await screen.findByText('Noch keine Routen.')).toBeTruthy();
    expect(requests).toEqual([]);
  });

  it('lists places with kind and address, and routes with mode, ends and the straight-line distance', async () => {
    await placeRepo.create({
      name: 'Wohnung',
      lat: 49.5981,
      lon: 11.0044,
      address: 'Schlossplatz',
      category: 'home',
      pinned: false,
    });
    await routeRepo.create({
      name: 'Zur Arbeit',
      mode: 'bike',
      from: { label: 'Wohnung', lat: 49.5981, lon: 11.0044 },
      to: { label: 'Büro', lat: 49.5712, lon: 11.0257 },
      via: [],
      pinned: false,
    });
    open();
    expect(await screen.findByText('Wohnung')).toBeTruthy();
    expect(screen.getByText('Zuhause · Schlossplatz')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Routen' }));
    const row = await screen.findByText(/Fahrrad · Wohnung → Büro · Luftlinie etwa 3[.,]\d km/);
    expect(row).toBeTruthy();
    expect(requests).toEqual([]);
  });

  it('the map tab loads tiles from OpenStreetMap only now, with the credit', async () => {
    await place('Wohnung', 49.5981, 11.0044);
    open('/maps?view=map');
    await screen.findByTestId('tile-map');
    await waitFor(() =>
      expect(requests.some((u) => u.startsWith('https://tile.openstreetmap.org/'))).toBe(true),
    );
    expect(
      requests.every((u) => /^https:\/\/tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/.test(u)),
    ).toBe(true);
    expect(screen.getByRole('link', { name: '© OpenStreetMap-Mitwirkende' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
    expect(await screen.findByTestId('map-marker')).toHaveAttribute('aria-label', 'Wohnung');
  });

  it('says so when the network is blocked', async () => {
    blockTiles = true;
    open('/maps?view=map');
    expect(await screen.findByText(/das Netzwerk ist gesperrt/)).toBeTruthy();
  });

  it('searches on submit only, picks a hit, saves it as a place and shows it as a marker', async () => {
    open('/maps?view=map');
    const input = await screen.findByLabelText('Ort oder Adresse suchen');
    fireEvent.change(input, { target: { value: 'Schloss' } });
    fireEvent.change(input, { target: { value: 'Schlossplatz Erlangen' } });
    expect(requests.filter((u) => hostOf(u) === 'nominatim.openstreetmap.org')).toHaveLength(0);
    fireEvent.submit(input.closest('form')!);
    const hits = await screen.findByTestId('map-hits');
    expect(requests.filter((u) => hostOf(u) === 'nominatim.openstreetmap.org')).toHaveLength(1);
    expect(requests.find((u) => hostOf(u) === 'nominatim.openstreetmap.org')).toContain(
      'q=Schlossplatz+Erlangen',
    );
    fireEvent.click(within(hits).getByText(/Erlangen, Bayern/));
    const card = await screen.findByTestId('map-selection');
    expect(card).toHaveTextContent('49.5981, 11.0044');
    fireEvent.click(within(card).getByRole('button', { name: 'Als Ort speichern' }));
    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('Schlossplatz');
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect(await placeRepo.active().count()).toBe(1));
    const saved = (await placeRepo.active().toArray())[0]!;
    expect(saved).toMatchObject({ name: 'Schlossplatz', lat: 49.5981, lon: 11.0044 });
  });

  it('a route from the selected point: pick the destination from the saved places', async () => {
    await place('Büro', 49.5712, 11.0257);
    open('/maps?view=map');
    const input = await screen.findByLabelText('Ort oder Adresse suchen');
    fireEvent.change(input, { target: { value: '49.5981, 11.0044' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(await screen.findByText('49.5981, 11.0044', { selector: 'span' }));
    const card = await screen.findByTestId('map-selection');
    fireEvent.click(within(card).getByRole('button', { name: 'Route von hier' }));
    const dialog = await screen.findByRole('dialog');
    const to = within(dialog).getByTestId('endpoint-Ziel');
    fireEvent.change(within(to).getByLabelText('Gespeicherter Ort'), {
      target: { value: (await placeRepo.active().toArray())[0]!.id },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => expect(await routeRepo.active().count()).toBe(1));
    const r = (await routeRepo.active().toArray())[0]!;
    expect(r).toMatchObject({
      mode: 'walk',
      from: { label: '49.5981, 11.0044' },
      to: { label: 'Büro', lat: 49.5712, lon: 11.0257 },
    });
    expect(r.name).toBe('49.5981, 11.0044 → Büro');
  });

  it('a route needs a start and a destination', async () => {
    open('/maps?view=routes');
    fireEvent.click(await screen.findByRole('button', { name: 'Route hinzufügen' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    expect(await within(dialog).findByText('Wähle Start und Ziel.')).toBeTruthy();
    expect(await routeRepo.active().count()).toBe(0);
  });

  it('?open=<place> shows it on the map with its card; ?open=<route> opens the editor', async () => {
    const p = await place('Hausarzt', 49.6012, 10.9987);
    const r = await routeRepo.create({
      name: 'Zum Bahnhof',
      mode: 'walk',
      from: { label: 'A', lat: 49.5981, lon: 11.0044 },
      to: { label: 'B', lat: 49.5958, lon: 11.002 },
      via: [],
      pinned: false,
    });
    open(`/maps?open=${p.id}`);
    const card = await screen.findByTestId('map-selection');
    expect(card).toHaveTextContent('Hausarzt');
    expect(within(card).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
    cleanup();
    open(`/maps?open=${r.id}`);
    expect(await screen.findByRole('dialog', { name: 'Route bearbeiten' })).toBeTruthy();
    expect(screen.getByLabelText('Name')).toHaveValue('Zum Bahnhof');
  });

  it('?new=1 (Quick-Add) opens the map tab with the search field ready', async () => {
    open('/maps?new=1');
    const input = await screen.findByLabelText('Ort oder Adresse suchen');
    await waitFor(() => expect(document.activeElement).toBe(input));
  });

  it('place links go to other map apps and nothing else is requested', async () => {
    await place('Wohnung', 49.5981, 11.0044);
    open('/maps?open=' + (await placeRepo.active().toArray())[0]!.id);
    const card = await screen.findByTestId('map-selection');
    expect(within(card).getByRole('link', { name: 'OpenStreetMap' })).toHaveAttribute(
      'href',
      expect.stringContaining('openstreetmap.org/?mlat=49.5981'),
    );
    expect(within(card).getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=49.5981,11.0044',
    );
    expect(within(card).queryByRole('link', { name: 'Karten-App des Geräts' })).toBeNull();
    expect(within(card).getByRole('link', { name: 'Apple Karten' })).toBeTruthy();
  });

  describe('route on the map', () => {
    const bike = () =>
      routeRepo.create({
        name: 'Zur Arbeit',
        mode: 'bike',
        from: { label: 'Wohnung', lat: 49.5981, lon: 11.0044 },
        to: { label: 'Büro', lat: 49.5712, lon: 11.0257 },
        via: [],
        pinned: false,
      });
    const calculate = async () => {
      fireEvent.click(await screen.findByRole('button', { name: 'Routen' }));
      await screen.findByText(/Zur Arbeit/);
      fireEvent.click(screen.getByRole('button', { name: 'Karten & Orte' }));
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Route auf der Karte berechnen' }),
      );
    };

    it('asks the routing service only on that click, then draws the line and lists the steps', async () => {
      await bike();
      open('/maps?view=routes');
      await screen.findByText(/Zur Arbeit/);
      expect(requests.filter((u) => hostOf(u) === 'routing.openstreetmap.de')).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'Karten & Orte' }));
      fireEvent.click(
        await screen.findByRole('menuitem', { name: 'Route auf der Karte berechnen' }),
      );
      const card = await screen.findByTestId('map-plan');
      await within(card).findByTestId('map-plan-summary');
      expect(card).toHaveTextContent(/3[.,]4 km/);
      expect(card).toHaveTextContent('21 Min.');
      const steps = within(card).getByTestId('map-plan-steps');
      expect(steps).toHaveTextContent('Los geht’s auf Hauptstraße');
      expect(steps).toHaveTextContent('Links abbiegen auf Ringweg');
      expect(steps).toHaveTextContent('Ziel erreicht');
      expect(await screen.findByTestId('map-line')).toBeTruthy();
      const asked = requests.filter((u) => hostOf(u) === 'routing.openstreetmap.de');
      expect(asked).toHaveLength(1);
      expect(asked[0]).toContain('/routed-bike/route/v1/driving/11.0044,49.5981;11.0257,49.5712');
      fireEvent.click(within(card).getByRole('button', { name: 'Route ausblenden' }));
      expect(screen.queryByTestId('map-plan')).toBeNull();
      expect(screen.queryByTestId('map-line')).toBeNull();
    });

    it('stays calm when there is no way or the service is down', async () => {
      await bike();
      routingAnswer = { status: 400, body: { code: 'NoRoute' } };
      open('/maps?view=routes');
      await calculate();
      expect(
        await screen.findByText('Für diese Punkte wurde keine Strecke gefunden.'),
      ).toBeTruthy();
    });

    it('says so when the network is blocked', async () => {
      await bike();
      blockTiles = true;
      open('/maps?view=routes');
      await calculate();
      expect(await screen.findByText(/Keine Berechnung: Das Netzwerk ist gesperrt/)).toBeTruthy();
    });

    it('public transport routes have no in-app calculation yet (only the apps)', async () => {
      await routeRepo.create({
        name: 'Mit dem Zug',
        mode: 'transit',
        from: { label: 'A', lat: 49.5981, lon: 11.0044 },
        to: { label: 'B', lat: 49.5712, lon: 11.0257 },
        via: [],
        pinned: false,
      });
      open('/maps?view=routes');
      await screen.findByText(/Mit dem Zug/);
      fireEvent.click(screen.getByRole('button', { name: 'Karten & Orte' }));
      await screen.findAllByRole('menuitem');
      expect(screen.queryByRole('menuitem', { name: 'Route auf der Karte berechnen' })).toBeNull();
    });
  });
});
