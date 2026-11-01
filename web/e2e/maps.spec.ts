import { expect, test, type Page } from '@playwright/test';
import { enable, openFoldedGroup, ready, showAllWidgets, showPreview } from './helpers';
import { overpassFixture } from '../src/modules/maps/own/fixtures';
import { SAMPLE_CENTER, samplePmtiles, sampleRegion } from '../src/modules/maps/own/sample';

// Preview modules, tools, connectors and sections are listed only with "In Arbeit anzeigen" (maturity).
test.beforeEach(({ page }) => showPreview(page));

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const hostOf = (url: string): string => new URL(url).host;

// A 1x1 transparent PNG: the tiles of the mocked map server.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Mocks OpenStreetMap's tile and search hosts; `seen` collects every URL that goes out. */
async function mockOsm(page: Page) {
  const seen: string[] = [];
  await page.route('**://tile.openstreetmap.org/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      body: PNG,
      contentType: 'image/png',
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route('**://nominatim.openstreetmap.org/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: [
        {
          display_name: 'Schlossplatz, Erlangen, Bayern, Deutschland',
          lat: '49.5981',
          lon: '11.0044',
          boundingbox: ['49.5950', '49.6010', '11.0000', '11.0090'],
        },
      ],
    });
  });
  await page.route('**://overpass-api.de/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: overpassFixture(),
    });
  });
  await page.route('**://api.transitous.org/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        itineraries: [
          {
            duration: 1800,
            startTime: '2026-09-29T08:00:00Z',
            endTime: '2026-09-29T08:30:00Z',
            transfers: 0,
            legs: [
              {
                mode: 'REGIONAL_RAIL',
                startTime: '2026-09-29T08:00:00Z',
                endTime: '2026-09-29T08:30:00Z',
                from: { name: 'Erlangen Hbf', lat: 49.5959, lon: 11.0 },
                to: { name: 'Nürnberg Hbf', lat: 49.4521, lon: 11.0767 },
                routeShortName: 'RE 1',
                headsign: 'Nürnberg',
              },
            ],
          },
        ],
      },
    });
  });
  await page.route('**://routing.openstreetmap.de/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
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
                  {
                    distance: 900,
                    duration: 300,
                    name: 'Hauptstraße',
                    maneuver: { type: 'depart' },
                  },
                  { distance: 0, duration: 0, name: '', maneuver: { type: 'arrive' } },
                ],
              },
            ],
          },
        ],
      },
    });
  });
  // An own host with a region file: answers range requests (and a preflight, should one come).
  const file = samplePmtiles();
  await page.route('**://maps.example/**', async (route) => {
    seen.push(route.request().url());
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET',
        },
      });
      return;
    }
    const m = /^bytes=(\d+)-(\d+)$/.exec(route.request().headers()['range'] ?? '');
    const start = m ? Number(m[1]) : 0;
    const end = m ? Math.min(Number(m[2]), file.length - 1) : file.length - 1;
    await route.fulfill({
      status: m ? 206 : 200,
      body: Buffer.from(file.subarray(start, end + 1)),
      contentType: 'application/octet-stream',
      headers: {
        'access-control-allow-origin': '*',
        'content-range': `bytes ${start}-${end}/${file.length}`,
      },
    });
  });
  return seen;
}

test.describe('Karten & Orte', () => {
  test('the module is off until it is switched on; then the lists open without any request', async ({
    page,
  }) => {
    const seen = await mockOsm(page);
    await enable(page, 'maps');
    await ready(page, '/maps');
    await expect(page.getByRole('heading', { name: 'Karten & Orte' })).toBeVisible();
    await expect(page.getByText('Noch keine Orte.')).toBeVisible();
    expect(seen).toEqual([]);
  });

  test('search, save a place, see it as a marker, open it in another app; the Overview shows it as a tile', async ({
    page,
    isMobile,
  }) => {
    const seen = await mockOsm(page);
    await showAllWidgets(page);
    await enable(page, 'maps');
    await ready(page, '/maps?view=map');
    // The first look at the map brings the one-time notice (clicked away by the helper); tiles follow.
    await expect(page.getByTestId('tile-map')).toBeVisible();
    await expect.poll(() => seen.some((u) => hostOf(u) === 'tile.openstreetmap.org')).toBe(true);

    await page.getByLabel('Ort oder Adresse suchen').fill('Schlossplatz Erlangen');
    await page.locator('main form').getByRole('button', { name: 'Suchen' }).click();
    await expect
      .poll(() => seen.find((u) => hostOf(u) === 'nominatim.openstreetmap.org'))
      .toContain('q=Schlossplatz+Erlangen');
    await page
      .getByTestId('map-hits')
      .getByText(/Schlossplatz, Erlangen/)
      .click();
    const card = page.getByTestId('map-selection');
    await expect(card).toContainText('49.5981, 11.0044');
    await expect(card.getByRole('link', { name: 'Google Maps' })).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=49.5981,11.0044',
    );
    await card.getByRole('button', { name: 'Als Ort speichern' }).click();
    await page.getByLabel('Name').fill('Schloss');
    await page.getByRole('switch', { name: 'Auf der Übersicht zeigen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByTestId('map-marker')).toHaveAttribute('aria-label', 'Schloss');

    // The map fits the window (also on a phone) and the marker is inside it.
    const map = await page.getByTestId('tile-map').boundingBox();
    expect(map!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (isMobile) expect(map!.width).toBeGreaterThan(250);

    await page.getByRole('button', { name: 'Orte', exact: true }).click();
    await expect(page.getByText('Schloss', { exact: true })).toBeVisible();

    await ready(page, '/');
    await page.getByRole('button', { name: 'Schloss' }).click();
    await expect(page).toHaveURL(/\/maps\?(.*)view=map/);
    await expect(page.getByTestId('map-selection')).toContainText('Schloss');
  });

  test('a route is saved from the list of places and opens in other apps from its menu', async ({
    page,
  }) => {
    await mockOsm(page);
    await enable(page, 'maps');
    await ready(page, '/maps?view=routes');
    await page.getByRole('button', { name: 'Route hinzufügen' }).first().click();
    await page.getByLabel('Name').first().fill('Zum Markt');
    await page.getByLabel('Unterwegs mit').selectOption('bike');
    const from = page.getByTestId('endpoint-Start');
    await from.getByLabel('Ort suchen').fill('49.5981, 11.0044');
    await from.getByRole('button', { name: 'Suchen' }).click();
    await from.getByRole('button', { name: '49.5981, 11.0044' }).click();
    const to = page.getByTestId('endpoint-Ziel');
    await to.getByLabel('Ort suchen').fill('49.5712, 11.0257');
    await to.getByRole('button', { name: 'Suchen' }).click();
    await to.getByRole('button', { name: '49.5712, 11.0257' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
    const row = page.getByText(/Fahrrad · 49\.5981, 11\.0044 → 49\.5712, 11\.0257/);
    await expect(row).toBeVisible();
    await expect(page.getByText('Zum Markt')).toBeVisible();
  });

  test('a saved route is calculated on the map only on click: line, distance, time and steps', async ({
    page,
  }) => {
    const seen = await mockOsm(page);
    await enable(page, 'maps');
    await ready(page, '/maps?view=routes');
    await page.getByRole('button', { name: 'Route hinzufügen' }).first().click();
    await page.getByLabel('Name').first().fill('Zum Markt');
    await page.getByLabel('Unterwegs mit').selectOption('bike');
    const from = page.getByTestId('endpoint-Start');
    await from.getByLabel('Ort suchen').fill('49.5981, 11.0044');
    await from.getByRole('button', { name: 'Suchen' }).click();
    await from.getByRole('button', { name: '49.5981, 11.0044' }).click();
    const to = page.getByTestId('endpoint-Ziel');
    await to.getByLabel('Ort suchen').fill('49.5712, 11.0257');
    await to.getByRole('button', { name: 'Suchen' }).click();
    await to.getByRole('button', { name: '49.5712, 11.0257' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByText('Zum Markt')).toBeVisible();
    expect(seen.filter((u) => hostOf(u) === 'routing.openstreetmap.de')).toEqual([]);

    await page.getByRole('button', { name: 'Karten & Orte', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Route auf der Karte berechnen' }).click();
    const plan = page.getByTestId('map-plan');
    await expect(plan).toContainText('21 Min.');
    await expect(plan.getByTestId('map-plan-steps')).toContainText('Los geht’s auf Hauptstraße');
    await expect(page.getByTestId('map-line')).toBeAttached();
    expect(seen.filter((u) => hostOf(u) === 'routing.openstreetmap.de')).toHaveLength(1);
    await plan.getByRole('button', { name: 'Route ausblenden' }).click();
    await expect(page.getByTestId('map-line')).toHaveCount(0);
  });

  test('a bus and train route finds connections only on click: list, line and steps', async ({
    page,
  }) => {
    const seen = await mockOsm(page);
    await enable(page, 'maps');
    await ready(page, '/maps?view=routes');
    await page.getByRole('button', { name: 'Route hinzufügen' }).first().click();
    await page.getByLabel('Name').first().fill('Mit dem Zug');
    await page.getByLabel('Unterwegs mit').selectOption('transit');
    const from = page.getByTestId('endpoint-Start');
    await from.getByLabel('Ort suchen').fill('49.5959, 11.0');
    await from.getByRole('button', { name: 'Suchen' }).click();
    await from.getByRole('button', { name: '49.5959, 11' }).click();
    const to = page.getByTestId('endpoint-Ziel');
    await to.getByLabel('Ort suchen').fill('49.4521, 11.0767');
    await to.getByRole('button', { name: 'Suchen' }).click();
    await to.getByRole('button', { name: '49.4521, 11.0767' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Speichern', exact: true }).click();
    await expect(page.getByText('Mit dem Zug')).toBeVisible();
    expect(seen.filter((u) => hostOf(u) === 'api.transitous.org')).toEqual([]);

    await page.getByRole('button', { name: 'Karten & Orte', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Verbindungen suchen' }).click();
    const card = page.getByTestId('map-transit');
    await expect(card.getByTestId('map-transit-options')).toContainText('30 Min.');
    await expect(card.getByTestId('map-transit-steps')).toContainText('RE 1 → Nürnberg');
    await expect(page.getByTestId('map-line')).toBeAttached();
    expect(seen.filter((u) => hostOf(u) === 'api.transitous.org')).toHaveLength(1);
  });

  test('the own map draws its stored tiles itself; offline-only leaves everything else empty', async ({
    page,
  }) => {
    const seen = await mockOsm(page);
    const coveredRequests = () =>
      seen.filter(
        (u) => hostOf(u) === 'tile.openstreetmap.org' && /\/1[2-9]\/\d+\/\d+\.png$/.test(u),
      );
    await enable(page, 'maps');
    await ready(page, '/maps');

    // Package 1 has no builder yet: the fixture town goes straight into the module's local tables,
    // in the row shape the repo writes (envelope + data; nothing of it is ever queued for sync).
    const { id, region, tiles } = sampleRegion();
    await page.evaluate(
      async ({ id, region, tiles }) => {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onsuccess = () => resolve(open.result);
          open.onerror = () => reject(open.error);
        });
        const envelope = (key: string) => ({
          id: key,
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
          deviceId: 'e2e',
          deletedAt: null,
          _f: {},
        });
        const tx = db.transaction(['maps_region', 'maps_tile'], 'readwrite');
        tx.objectStore('maps_region').put({ ...region, ...envelope(id) });
        for (const t of tiles)
          tx.objectStore('maps_tile').put({
            ...t.data,
            bytes: new Uint8Array(t.data.bytes).buffer,
            ...envelope(t.id),
          });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        db.close();
      },
      {
        id,
        region,
        tiles: tiles.map((t) => ({
          id: t.id,
          data: { ...t.data, bytes: Array.from(new Uint8Array(t.data.bytes)) },
        })),
      },
    );

    await ready(page, '/maps?view=map');
    await expect(page.getByTestId('tile-map')).toBeVisible();
    // Coordinates are read locally (no search request) and put the map on the town at zoom 16.
    const centre = `${SAMPLE_CENTER.lat}, ${SAMPLE_CENTER.lon}`;
    await page.getByLabel('Ort oder Adresse suchen').fill(centre);
    await page.locator('main form').getByRole('button', { name: 'Suchen' }).click();
    await page.getByTestId('map-hits').getByText(centre).click();
    const map = page.getByTestId('tile-map');
    await expect.poll(() => map.locator('img[src^="blob:"]').count()).toBeGreaterThan(3);
    expect(seen.filter((u) => hostOf(u) === 'nominatim.openstreetmap.org')).toEqual([]);
    expect(coveredRequests()).toEqual([]);
    await test.info().attach('own-map', { body: await map.screenshot(), contentType: 'image/png' });

    // Zooming out beyond the stored zooms still shows the online tiles (the default).
    for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Verkleinern' }).click();
    await expect
      .poll(
        () => seen.filter((u) => hostOf(u) === 'tile.openstreetmap.org' && /\/10\//.test(u)).length,
      )
      .toBeGreaterThan(0);

    // "Nur eigene Karte (offline)": nothing outside the own map is requested or drawn.
    await ready(page, '/settings/module');
    await openFoldedGroup(page, 'module-maps', 'fields');
    const toggle = page.getByRole('switch', { name: 'Nur eigene Karte (offline)' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    const before = seen.length;
    await ready(page, '/maps?view=map');
    await expect(page.getByTestId('tile-map')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Verkleinern' })).toBeVisible();
    await page.waitForTimeout(400); // give a stray request the chance to show up
    expect(seen.slice(before).filter((u) => hostOf(u) === 'tile.openstreetmap.org')).toEqual([]);
    await expect(page.getByTestId('tile-map').locator('img')).toHaveCount(0);
    await expect(page.getByText(/konnten nicht geladen werden/)).toHaveCount(0);
  });

  test('the own map is built from the map data service only on click, cell by cell, and can be deleted', async ({
    page,
  }) => {
    const seen = await mockOsm(page);
    await enable(page, 'maps');
    await ready(page, '/maps?view=map');
    await page.getByLabel('Ort oder Adresse suchen').fill('Schlossplatz Erlangen');
    await page.locator('main form').getByRole('button', { name: 'Suchen' }).click();
    await page
      .getByTestId('map-hits')
      .getByText(/Schlossplatz, Erlangen/)
      .click();
    const card = page.getByTestId('map-selection');
    expect(seen.filter((u) => hostOf(u) === 'overpass-api.de')).toEqual([]);
    // The first build brings its own one-time notice (clicked away by the helper), then the requests.
    await card.getByRole('button', { name: 'Eigene Karte erzeugen' }).click();
    const row = page.getByTestId('map-region');
    await expect(row).toContainText('Schlossplatz');
    await expect(row).toHaveAttribute('data-status', 'done', { timeout: 20_000 });
    await expect(row).toContainText(/Fertig · \d+ Teile/);
    expect(seen.filter((u) => hostOf(u) === 'overpass-api.de').length).toBeGreaterThanOrEqual(1);
    // Every request is a POST with the query in its body, never in the address.
    for (const u of seen.filter((u) => hostOf(u) === 'overpass-api.de'))
      expect(u).not.toContain('data=');
    // The map draws its own tiles for the built area.
    const map = page.getByTestId('tile-map');
    await expect.poll(() => map.locator('img[src^="blob:"]').count()).toBeGreaterThan(0);
    await test
      .info()
      .attach('own-map-built', { body: await map.screenshot(), contentType: 'image/png' });

    // "Genauer machen": the same area again at the full level (buildings, paths, names).
    const before = seen.filter((u) => hostOf(u) === 'overpass-api.de').length;
    await row.getByRole('button', { name: 'Genauer machen' }).click();
    await expect(row).toHaveAttribute('data-status', 'done', { timeout: 20_000 });
    await expect(row).toContainText(/genau · Fertig/);
    expect(seen.filter((u) => hostOf(u) === 'overpass-api.de').length).toBeGreaterThan(before);
    await expect(row.getByRole('button', { name: 'Genauer machen' })).toHaveCount(0);

    // Zoomed out, the shown area has cells no own map holds: "Hier erweitern" builds just those
    // (two steps: a wide desktop window at z12 would mean dozens of cells, a second each).
    for (let i = 0; i < 2; i++) await page.getByRole('button', { name: 'Verkleinern' }).click();
    await page.getByTestId('map-extend').click();
    await expect(page.getByTestId('map-region')).toHaveCount(2);
    // The e2e clock is frozen, so both regions share a creation time: find the new one by name.
    const section = page.getByTestId('map-region').filter({ hasText: 'Kartenausschnitt' });
    await expect(section).toHaveCount(1);
    await expect(section).toHaveAttribute('data-status', 'done', { timeout: 45_000 });

    await page.getByRole('button', { name: 'Alle Karten löschen' }).click();
    await expect(page.getByText('Alle eigenen Karten löschen?')).toBeVisible();
    await page.getByRole('button', { name: 'Alle Karten löschen' }).click();
    await expect(page.getByTestId('map-region')).toHaveCount(0);
  });

  test('a region file on an own host is copied with range requests; the map data service is never asked', async ({
    page,
  }) => {
    const seen = await mockOsm(page);
    const fileRequests = () => seen.filter((u) => hostOf(u) === 'maps.example');
    await enable(page, 'maps');
    // The address of the file is a module setting (saved on leaving the field).
    await ready(page, '/settings/module');
    await openFoldedGroup(page, 'module-maps', 'fields');
    const field = page.getByLabel('Kartendatei (Adresse)');
    await field.fill('https://maps.example/nemostadt.pmtiles');
    await field.blur();
    await ready(page, '/settings/module');
    await openFoldedGroup(page, 'module-maps', 'fields');
    await expect(page.getByLabel('Kartendatei (Adresse)')).toHaveValue(
      'https://maps.example/nemostadt.pmtiles',
    );
    expect(fileRequests()).toEqual([]);

    await ready(page, '/maps?view=map');
    await page.getByLabel('Ort oder Adresse suchen').fill('Schlossplatz Erlangen');
    await page.locator('main form').getByRole('button', { name: 'Suchen' }).click();
    await page
      .getByTestId('map-hits')
      .getByText(/Schlossplatz, Erlangen/)
      .click();
    await page
      .getByTestId('map-selection')
      .getByRole('button', { name: 'Eigene Karte erzeugen' })
      .click();
    const row = page.getByTestId('map-region');
    await expect(row).toHaveAttribute('data-status', 'done', { timeout: 30_000 });
    await expect(row).toContainText(/aus Kartendatei · genau · Fertig/);
    await expect(row).toContainText('Kartendaten © OpenStreetMap-Mitwirkende (Beispiel)');
    await expect(row.getByRole('button', { name: 'Genauer machen' })).toHaveCount(0);
    expect(seen.filter((u) => hostOf(u) === 'overpass-api.de')).toEqual([]);
    expect(fileRequests().length).toBeGreaterThan(1);
    // The map draws the copied tiles itself.
    const map = page.getByTestId('tile-map');
    await expect.poll(() => map.locator('img[src^="blob:"]').count()).toBeGreaterThan(0);
    await test
      .info()
      .attach('own-map-file', { body: await map.screenshot(), contentType: 'image/png' });
  });
});
