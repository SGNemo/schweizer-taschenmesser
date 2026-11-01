// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { NetBlockedError } from '@/core/net/netlog';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setSettings } from '@/core/settings/settings';
import { clearTileCache } from '../tiles';
import { resetBuilder } from '../own/builder';
import { overpassFixture } from '../own/fixtures';
import { SAMPLE_CENTER, sampleRegion } from '../own/sample';
import { placeRepo, regionRepo, routeRepo, tileRepo } from '../repo';

// jsdom has no canvas: the own map's drawing is a tiny PNG stand-in here (the renderer has its own tests).
vi.mock('../own/draw', () => ({
  drawTile: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
import MapsPage from '../routes/MapsPage';

const requests: string[] = [];
const hostOf = (url: string): string => new URL(url).host;
let blockTiles = false;
const MOTIS_OK = {
  itineraries: [
    {
      duration: 1800,
      startTime: '2026-11-02T08:00:00Z',
      endTime: '2026-11-02T08:30:00Z',
      transfers: 0,
      legs: [
        {
          mode: 'REGIONAL_RAIL',
          startTime: '2026-11-02T08:00:00Z',
          endTime: '2026-11-02T08:30:00Z',
          from: { name: 'Erlangen Hbf', lat: 49.5959, lon: 11.0 },
          to: { name: 'Nürnberg Hbf', lat: 49.4521, lon: 11.0767 },
          routeShortName: 'RE 1',
          headsign: 'Nürnberg',
        },
      ],
    },
  ],
};
let transitAnswer: unknown = MOTIS_OK;
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
              boundingbox: ['49.5950', '49.6010', '11.0000', '11.0090'],
            },
            { display_name: 'Schlossplatz, Stuttgart', lat: '48.7785', lon: '9.1800' },
          ]),
          { status: 200 },
        );
      }
      if (hostOf(url) === 'api.transitous.org') {
        if (blockTiles) throw new NetBlockedError();
        return new Response(JSON.stringify(transitAnswer), { status: 200 });
      }
      if (hostOf(url) === 'overpass-api.de') {
        if (blockTiles) throw new NetBlockedError();
        return new Response(JSON.stringify(overpassFixture()), { status: 200 });
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
  transitAnswer = MOTIS_OK;
  let n = 0;
  URL.createObjectURL = () => `blob:t${++n}`;
  URL.revokeObjectURL = () => undefined;
  clearTileCache();
  install();
  await db.table('maps_place').clear();
  await db.table('maps_route').clear();
  await db.table('maps_region').clear();
  await db.table('maps_tile').clear();
  await db.table('_settings').clear();
  resetBuilder();
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

    it('public transport: connections are searched on click, listed, with line and stops', async () => {
      await routeRepo.create({
        name: 'Mit dem Zug',
        mode: 'transit',
        from: { label: 'A', lat: 49.5981, lon: 11.0044 },
        to: { label: 'B', lat: 49.4521, lon: 11.0767 },
        via: [],
        pinned: false,
      });
      open('/maps?view=routes');
      await screen.findByText(/Mit dem Zug/);
      expect(requests.filter((u) => hostOf(u) === 'api.transitous.org')).toHaveLength(0);
      fireEvent.click(screen.getByRole('button', { name: 'Karten & Orte' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Verbindungen suchen' }));
      const card = await screen.findByTestId('map-transit');
      const options = await within(card).findByTestId('map-transit-options');
      expect(options).toHaveTextContent('Direkt');
      expect(options).toHaveTextContent('30 Min.');
      expect(within(card).getByTestId('map-transit-steps')).toHaveTextContent(
        'Erlangen Hbf · Bahn RE 1 → Nürnberg · ',
      );
      const asked = requests.filter((u) => hostOf(u) === 'api.transitous.org');
      expect(asked).toHaveLength(1);
      expect(asked[0]).toContain('fromPlace=49.5981%2C11.0044');
      expect(await screen.findByTestId('map-line')).toBeTruthy();
      fireEvent.click(within(card).getByRole('button', { name: 'Verbindungen ausblenden' }));
      expect(screen.queryByTestId('map-transit')).toBeNull();
    });

    it('says calmly when no connection is found', async () => {
      await routeRepo.create({
        name: 'Mit dem Zug',
        mode: 'transit',
        from: { label: 'A', lat: 49.5981, lon: 11.0044 },
        to: { label: 'B', lat: 49.4521, lon: 11.0767 },
        via: [],
        pinned: false,
      });
      transitAnswer = { itineraries: [] };
      open('/maps?view=routes');
      await screen.findByText(/Mit dem Zug/);
      fireEvent.click(screen.getByRole('button', { name: 'Karten & Orte' }));
      fireEvent.click(await screen.findByRole('menuitem', { name: 'Verbindungen suchen' }));
      expect(await screen.findByText(/Keine Verbindung gefunden/)).toBeTruthy();
    });

    it('public transport routes have no car-style calculation (only connections and the apps)', async () => {
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

describe('own map (stored vector tiles)', () => {
  const tileRequests = () =>
    requests.filter((u) => u.startsWith('https://tile.openstreetmap.org/'));
  /** Online requests for the zooms the fixture covers (the first frame shows the whole country at zoom 5). */
  const coveredRequests = () => tileRequests().filter((u) => /\/1[2-9]\/\d+\/\d+\.png$/.test(u));
  const blobTiles = () => document.querySelectorAll('[data-testid="tile-map"] img[src^="blob:"]');

  async function storeSample() {
    const { id, region, tiles } = sampleRegion();
    await regionRepo.create(region, { id });
    await tileRepo.createMany(tiles.map((t) => ({ id: t.id, data: t.data })));
  }

  it('draws its own tiles for the area it covers and asks the internet for nothing there', async () => {
    await storeSample();
    await place('Wohnung', SAMPLE_CENTER.lat, SAMPLE_CENTER.lon);
    open('/maps?view=map');
    await screen.findByTestId('tile-map');
    await waitFor(() => expect(blobTiles().length).toBeGreaterThan(3));
    expect(coveredRequests()).toEqual([]);
    expect(screen.getByRole('link', { name: '© OpenStreetMap-Mitwirkende' })).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/copyright',
    );
    // The stored rows are caches: nothing is queued for sync.
    expect(await db.table('_outbox').where('collection').equals('maps_tile').count()).toBe(0);
  });

  it('falls back to the online tiles outside the own map, unless the map is offline-only', async () => {
    await storeSample();
    open('/maps?view=map');
    await screen.findByTestId('tile-map');
    // No places: the map opens on the whole country, far above the stored zooms.
    await waitFor(() => expect(tileRequests().length).toBeGreaterThan(0));
    expect(blobTiles().length).toBeGreaterThan(0);
    cleanup();
    requests.length = 0;
    await setSettings('module.maps', { offlineOnly: true });
    open('/maps?view=map');
    await screen.findByTestId('tile-map');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Vergrößern' })).toBeTruthy());
    await new Promise((r) => setTimeout(r, 50));
    expect(tileRequests()).toEqual([]);
    expect(screen.queryByText(/konnten nicht geladen werden/)).toBeNull();
  });
});

describe('own map build (Overpass)', () => {
  const overpassRequests = () => requests.filter((u) => hostOf(u) === 'overpass-api.de');
  const blobTiles = () => document.querySelectorAll('[data-testid="tile-map"] img[src^="blob:"]');

  async function chooseErlangen() {
    open('/maps?view=map');
    const input = await screen.findByLabelText('Ort oder Adresse suchen');
    fireEvent.change(input, { target: { value: 'Schlossplatz Erlangen' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(within(await screen.findByTestId('map-hits')).getByText(/Erlangen, Bayern/));
    return screen.findByTestId('map-selection');
  }

  it('a search hit with an area offers the own map; a click builds it cell by cell, nothing before', async () => {
    const card = await chooseErlangen();
    expect(overpassRequests()).toEqual([]);
    fireEvent.click(within(card).getByRole('button', { name: 'Eigene Karte erzeugen' }));
    const row = await screen.findByTestId('map-region');
    expect(row).toHaveTextContent('Schlossplatz');
    await waitFor(() => expect(row).toHaveAttribute('data-status', 'done'), { timeout: 5000 });
    expect(row).toHaveTextContent(/abgespeckt · Fertig · \d+ Teile/);
    const region = (await regionRepo.active().toArray())[0]!;
    expect(region.cells.done).toBe(region.cells.total);
    expect(overpassRequests()).toHaveLength(region.cells.total);
    expect(await tileRepo.active().count()).toBeGreaterThan(region.cells.total);
    // The map now draws the stored tiles itself.
    await waitFor(() => expect(blobTiles().length).toBeGreaterThan(0));
    expect(screen.getByText(/Die Karte entsteht/)).toBeTruthy();
    // Nothing of it is queued for sync.
    expect(
      await db.table('_outbox').where('collection').anyOf(['maps_region', 'maps_tile']).count(),
    ).toBe(0);
  });

  it('a coordinate hit has no area and no build button; a built map can be deleted after a second look', async () => {
    open('/maps?view=map');
    const input = await screen.findByLabelText('Ort oder Adresse suchen');
    fireEvent.change(input, { target: { value: '49.5981, 11.0044' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.click(await screen.findByText('49.5981, 11.0044', { selector: 'span' }));
    const card = await screen.findByTestId('map-selection');
    expect(within(card).queryByRole('button', { name: 'Eigene Karte erzeugen' })).toBeNull();
    cleanup();

    const hit = await chooseErlangen();
    fireEvent.click(within(hit).getByRole('button', { name: 'Eigene Karte erzeugen' }));
    const row = await screen.findByTestId('map-region');
    await waitFor(() => expect(row).toHaveAttribute('data-status', 'done'), { timeout: 5000 });
    fireEvent.click(within(row).getByRole('button', { name: 'Karte löschen' }));
    expect(within(row).getByText('Wirklich löschen?')).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: 'Behalten' }));
    expect(within(row).queryByText('Wirklich löschen?')).toBeNull();
    fireEvent.click(within(row).getByRole('button', { name: 'Karte löschen' }));
    fireEvent.click(within(row).getByRole('button', { name: 'Karte löschen' }));
    await waitFor(async () => expect(await regionRepo.table.count()).toBe(0));
    expect(await tileRepo.table.count()).toBe(0);
    await waitFor(() => expect(screen.queryByTestId('map-region')).toBeNull());
  });

  it('a blocked network pauses the build with a calm reason and "Weiter"', async () => {
    const card = await chooseErlangen();
    blockTiles = true;
    fireEvent.click(within(card).getByRole('button', { name: 'Eigene Karte erzeugen' }));
    const row = await screen.findByTestId('map-region');
    await waitFor(() => expect(row).toHaveAttribute('data-status', 'paused'), { timeout: 5000 });
    expect(row).toHaveTextContent(/Angehalten bei 0 von \d+ · Keine Verbindung/);
    expect(within(row).getByRole('button', { name: 'Weiter' })).toBeTruthy();
  });
});
