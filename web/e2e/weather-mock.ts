import type { Page } from '@playwright/test';

/**
 * Invented Open-Meteo answers for screenshots and manual tooling (a cloudy day in Bern, rain at 15:00, one warm
 * and one cold day in the week). Shared by the screenshot specs; the E2E weather spec keeps its own, stricter data.
 */
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

export async function mockWeather(page: Page) {
  await page.route('**://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
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
    }),
  );
  await page.route('**://air-quality-api.open-meteo.com/**', (route) =>
    route.fulfill({
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
    }),
  );
  await page.route('**://api.open-meteo.com/**', (route) =>
    route.fulfill({
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
          time: days7,
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
    }),
  );
}

/**
 * Picks "Bern" as the weather place through the settings (the geocoding answer is mocked above). The first search
 * opens the data-flow notice ("Verstanden"); the search is repeated after it. False when the flow fails.
 */
export async function pickWeatherPlace(page: Page): Promise<boolean> {
  try {
    await page.goto('/settings/verbindungen');
    await page.getByLabel('Ort suchen').fill('Bern', { timeout: 15_000 });
    const search = page
      .locator('#weather--place')
      .getByRole('button', { name: 'Suchen', exact: true });
    await search.click({ timeout: 15_000 });
    const notice = page.getByRole('button', { name: 'Verstanden' });
    const pick = page.getByRole('button', { name: 'Bern, Schweiz wählen' });
    // Either the data-flow notice or the result comes next. `isVisible()` does not wait, so wait for one of them
    // first (the notice used to be missed when it rendered a moment later, and the place was never picked).
    await notice.or(pick).first().waitFor({ state: 'visible', timeout: 15_000 });
    if (await notice.isVisible()) {
      await notice.click();
      const shown = await pick
        .waitFor({ state: 'visible', timeout: 3_000 })
        .then(() => true)
        .catch(() => false);
      if (!shown) await search.click();
    }
    await pick.click({ timeout: 15_000 });
    // The choice is stored asynchronously: a navigation right after the click would lose it.
    await page
      .getByTestId('weather-place')
      .filter({ hasText: 'Bern' })
      .waitFor({ timeout: 15_000 });
    return true;
  } catch {
    return false;
  }
}
