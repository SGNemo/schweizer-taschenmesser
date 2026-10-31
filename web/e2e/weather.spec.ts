import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const times = Array.from({ length: 24 }, (_, h) => `2026-09-29T${String(h).padStart(2, '0')}:00`);
const days7 = [
  '2026-09-29',
  '2026-09-30',
  '2026-10-01',
  '2026-10-02',
  '2026-10-03',
  '2026-10-04',
  '2026-10-05',
];
const nextDay = times.map((t) => t.replace('-29T', '-30T'));

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
  await page.route('**://air-quality-api.open-meteo.com/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      json: {
        current: {
          european_aqi: 52,
          pm2_5: 12.4,
          pm10: 20,
          ozone: 80,
          birch_pollen: 120,
          grass_pollen: 3,
          alder_pollen: 0,
        },
        hourly: {
          time: [...times, ...nextDay],
          birch_pollen: Array.from({ length: 48 }, (_, i) => (i >= 24 ? 200 : 120)),
          grass_pollen: Array.from({ length: 48 }, () => 3),
        },
      },
    });
  });
  await page.route('**://api.open-meteo.com/**', async (route) => {
    seen.push(route.request().url());
    await route.fulfill({
      json: {
        current: {
          time: '2026-09-29T10:00',
          temperature_2m: 14.2,
          weather_code: 2,
          apparent_temperature: 12.4,
          relative_humidity_2m: 70,
          wind_speed_10m: 14,
          wind_gusts_10m: 30,
          is_day: 1,
        },
        hourly: {
          time: [...times, ...nextDay],
          temperature_2m: Array.from({ length: 48 }, (_, i) => 10 + (i % 6)),
          apparent_temperature: Array.from({ length: 48 }, (_, i) => 9 + (i % 6)),
          precipitation: Array.from({ length: 48 }, (_, i) => (i === 15 ? 1.4 : 0)),
          wind_speed_10m: Array.from({ length: 48 }, () => 12),
          wind_gusts_10m: Array.from({ length: 48 }, () => 25),
          relative_humidity_2m: Array.from({ length: 48 }, () => 70),
          uv_index: Array.from({ length: 48 }, () => 1),
          is_day: Array.from({ length: 48 }, (_, i) => (i % 24 >= 7 && i % 24 < 19 ? 1 : 0)),
          weather_code: Array.from({ length: 48 }, () => 3),
          precipitation_probability: Array.from({ length: 48 }, (_, i) => (i === 15 ? 80 : 0)),
        },
        daily: {
          time: [
            '2026-09-29',
            '2026-09-30',
            '2026-10-01',
            '2026-10-02',
            '2026-10-03',
            '2026-10-04',
            '2026-10-05',
          ],
          weather_code: [2, 61, 0, 95, 3, 71, 1],
          temperature_2m_max: [15, 14, 17, 12, 13, 5, 16],
          temperature_2m_min: [8, 9, 6, 7, 8, 1, 7],
          precipitation_probability_max: [80, 70, 0, 90, 10, 40, 0],
          apparent_temperature_max: [14, 13, 16, 11, 12, 3, 15],
          apparent_temperature_min: [7, 8, 5, 6, 7, -1, 6],
          precipitation_sum: [3, 6, 0, 9, 0.5, 2, 0],
          wind_speed_10m_max: [20, 25, 10, 40, 15, 22, 12],
          wind_gusts_10m_max: [40, 45, 20, 70, 30, 40, 25],
          uv_index_max: [3, 2, 4, 1, 2, 1, 3],
          sunrise: days7.map((d) => `${d}T07:05`),
          sunset: days7.map((d) => `${d}T18:51`),
          sunshine_duration: [18000, 7200, 36000, 3600, 14400, 3600, 30000],
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

  test('without a place: one quiet hint, "Später nicht mehr" ends it', async ({ page }) => {
    const seen = await mockWeather(page);
    await ready(page, '/');
    await expect(page.getByTestId('weather-hint')).toContainText('Wetter: Stadt wählen');
    await page.getByRole('button', { name: 'Später nicht mehr' }).click();
    await expect(page.getByTestId('weather-hint')).toHaveCount(0);
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('weather-hint')).toHaveCount(0);
    expect(seen).toEqual([]);
  });

  test('the line opens a preview: 24 hours and 7 days; Escape and Back close it', async ({
    page,
    isMobile,
  }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toBeVisible();
    await page.getByTestId('weather-line').click();
    const preview = page.getByTestId('weather-preview');
    await expect(preview).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    await expect(preview.getByTestId('weather-hours').locator('li')).toHaveCount(8);
    await preview.getByTestId('weather-hours-toggle').click();
    await expect(preview.getByTestId('weather-hours').locator('li')).toHaveCount(24);
    await expect(preview.getByTestId('weather-days').locator('li')).toHaveCount(7);
    await expect(preview.getByTestId('weather-hours').locator('li').first()).toContainText('10:00');
    await expect(preview.getByTestId('weather-hours').locator('li').nth(5)).toContainText(
      'Regen 80 %',
    );
    await expect(preview.getByTestId('weather-days').locator('li').nth(3)).toContainText(
      'Gewitter',
    );
    await expect(preview.getByTestId('weather-preview-credit')).toContainText('Open-Meteo.com');
    await expect(preview.getByTestId('weather-chart')).toBeVisible();
    // Airways and allergy: air index with its word, pollen strongest first, always with words.
    await expect(preview.getByTestId('weather-aqi')).toContainText('mäßig');
    await expect(preview.getByTestId('weather-pollen').locator('li').first()).toContainText(
      'Birke',
    );
    await expect(preview.getByTestId('weather-pollen').locator('li').first()).toContainText('hoch');
    await expect(preview.getByTestId('weather-days').locator('li').nth(1)).toContainText(
      'Pollen: Birke',
    );
    await expect(preview.getByTestId('weather-now')).toContainText('gefühlt 12°');
    await expect(preview.getByTestId('weather-now')).toContainText('Wind 14 km/h');
    // Colour never stands alone: every row names its rating.
    await expect(preview.locator('[data-rating]').first()).toHaveText(/Gut|Geht so|Ungemütlich/);
    await expect(preview.getByTestId('weather-hours').locator('li').nth(5)).toContainText(
      'Ungemütlich',
    );
    // The chart fits the window width on a phone too.
    const box = await preview.getByTestId('weather-chart').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (isMobile) expect(box!.width).toBeGreaterThan(250);
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);

    await page.getByTestId('weather-line').click();
    await expect(page.getByTestId('weather-preview')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('weather-preview')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test('the preview links on to the weather settings', async ({ page }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await page.getByTestId('weather-line').click();
    await page.getByTestId('weather-preview').getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL(/\/settings\/verbindungen/);
    await expect(page.getByTestId('weather-place')).toBeVisible();
  });

  test('offline later: the old values stay, marked "Stand hh:mm", no rain hint', async ({
    page,
  }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toContainText('ab 15 Uhr Regen');
    // An hour later the forecast cannot be reached any more.
    await page.clock.setFixedTime(new Date('2026-09-29T11:00:00'));
    await page.route('**://api.open-meteo.com/**', (route) => route.abort());
    await ready(page, '/');
    await expect(page.getByTestId('weather-line')).toHaveText(
      'Bern · 14° leicht bewölkt · Stand 10:00',
    );
    // The last preview stays, marked with its time; the hours start at the place's current hour.
    await page.getByTestId('weather-line').click();
    const preview = page.getByTestId('weather-preview');
    await expect(preview).toContainText('Stand 10:00');
    await expect(preview.getByTestId('weather-hours').locator('li').first()).toContainText('11:00');
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

  test('the settings credit Open-Meteo (CC BY 4.0)', async ({ page }) => {
    await ready(page, '/settings/verbindungen');
    const credit = page.getByTestId('weather-attribution');
    await expect(credit).toContainText('Wetterdaten von');
    await expect(credit.getByRole('link', { name: 'Open-Meteo.com (CC BY 4.0)' })).toHaveAttribute(
      'href',
      'https://open-meteo.com/',
    );
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
