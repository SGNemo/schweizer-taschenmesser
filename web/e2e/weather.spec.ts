import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const times = Array.from({ length: 24 }, (_, h) => `2026-09-29T${String(h).padStart(2, '0')}:00`);

/** Open-Meteo answers, made up; counts the requests that leave for the weather host. */
async function mockWeather(page: Page) {
  const seen: string[] = [];
  await page.route('**://geocoding-api.open-meteo.com/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      json: {
        results: [
          {
            name: 'Bern',
            admin1: 'Bern',
            country: 'Schweiz',
            latitude: 46.9481,
            longitude: 7.4474,
          },
        ],
      },
    });
  });
  await page.route('**://api.open-meteo.com/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      json: {
        current: { time: '2026-09-29T10:00', temperature_2m: 14.2, weather_code: 2 },
        hourly: {
          time: times,
          precipitation_probability: times.map((_, h) => (h === 15 ? 80 : 0)),
        },
      },
    });
  });
  return seen;
}

async function choosePlace(page: Page) {
  await ready(page, '/settings/verbindungen');
  await page.getByLabel('Ort suchen').fill('Bern');
  await page
    .locator('#weather--place')
    .getByRole('button', { name: 'Suchen', exact: true })
    .click();
  await page.getByRole('button', { name: 'Bern, Schweiz wählen' }).click();
  await expect(page.getByTestId('weather-place')).toHaveText('Bern, Schweiz');
}

test.describe('Weather line', () => {
  test('without a place nothing is shown and nothing is requested', async ({ page }) => {
    const seen = await mockWeather(page);
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('weather-line')).toHaveCount(0);
    expect(seen).toEqual([]);
  });

  test('choose a place once: the Overview shows one calm line with the rain hint', async ({
    page,
  }) => {
    const seen = await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toHaveText(
      'Bern · 14° leicht bewölkt · ab 15 Uhr Regen',
    );
    // Only the typed name (search) and the rounded position (forecast) went out.
    const forecast = seen.find((u) => u.includes('api.open-meteo.com/v1/forecast'))!;
    expect(forecast).toContain('latitude=46.95');
    expect(forecast).toContain('longitude=7.45');
    expect(seen.find((u) => u.includes('geocoding'))).toContain('name=Bern');
  });

  test('the switch and "Ort entfernen" take the line away again', async ({ page }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toBeVisible();

    await ready(page, '/settings/verbindungen');
    await page.getByRole('switch', { name: 'Wetter auf der Übersicht' }).click();
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toHaveCount(0);

    await ready(page, '/settings/verbindungen');
    await page.getByRole('switch', { name: 'Wetter auf der Übersicht' }).click();
    await page.getByRole('button', { name: 'Ort entfernen' }).click();
    await expect(page.getByTestId('weather-place')).toHaveText('Noch kein Ort gewählt.');
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toHaveCount(0);
  });

  test('an unreachable service leaves no error on the Overview', async ({ page }) => {
    await mockWeather(page);
    await choosePlace(page);
    // Routes registered later win: from here on the forecast cannot be reached.
    await page.route('**://api.open-meteo.com/**', (route) => route.abort());
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('weather-line')).toHaveCount(0);
    await expect(page.getByText('nicht erreichbar')).toHaveCount(0);
  });

  test('a failing search says so calmly in the settings', async ({ page }) => {
    await page.route('**://geocoding-api.open-meteo.com/**', (route) => route.abort());
    await ready(page, '/settings/verbindungen');
    await page.getByLabel('Ort suchen').fill('Bern');
    await page
      .locator('#weather--place')
      .getByRole('button', { name: 'Suchen', exact: true })
      .click();
    await expect(
      page.getByText('Gerade nicht erreichbar. Probier es später noch einmal.'),
    ).toBeVisible();
  });
});
