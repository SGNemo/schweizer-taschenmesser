import { expect, test, type Page } from '@playwright/test';
import { enable, ready, showAllWidgets } from './helpers';

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
        },
      ],
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
});
