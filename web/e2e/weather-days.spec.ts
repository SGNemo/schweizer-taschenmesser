import { expect, test, type Page } from '@playwright/test';
import { ready } from './helpers';

/**
 * Weather round 2, package C (CONCEPT-DAYS): the page shows one moment – now, a chosen day or a chosen hour – and
 * everything follows it. Deterministic "today": Thursday 2026-11-26, 10:00; the forecast has all 168 hours.
 */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-26T10:00:00'));
});

const DAYS = [
  '2026-11-26',
  '2026-11-27',
  '2026-11-28',
  '2026-11-29',
  '2026-11-30',
  '2026-12-01',
  '2026-12-02',
];
const HOURS = DAYS.flatMap((d) =>
  Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`),
);
const MAX = [6, 5, 4, 7, 3, 8, 6];
const MIN = [1, 1, -3, 2, -1, 0, 2];
/** A day's curve: low at 05:00, the high at 14:00, distinct per day so every head is its own. */
const tempAt = (i: number) => {
  const d = Math.floor(i / 24);
  const h = i % 24;
  const w = Math.max(0, 1 - Math.abs(h - 14) / 9);
  return Math.round((MIN[d]! + (MAX[d]! - MIN[d]!) * w) * 10) / 10;
};

async function mockWeek(page: Page) {
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
        current: { european_aqi: 22, pm2_5: 4, pm10: 8, ozone: 44 },
        hourly: {
          time: HOURS.slice(0, 120),
          european_aqi: HOURS.slice(0, 120).map((_, i) => 20 + Math.floor(i / 24) * 5),
          birch_pollen: HOURS.slice(0, 120).map(() => 0),
        },
      },
    }),
  );
  await page.route('**://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        current: {
          time: '2026-11-26T10:00',
          temperature_2m: 3.4,
          weather_code: 3,
          apparent_temperature: 0.2,
          relative_humidity_2m: 80,
          wind_speed_10m: 12,
          wind_gusts_10m: 25,
          is_day: 1,
        },
        hourly: {
          time: HOURS,
          temperature_2m: HOURS.map((_, i) => tempAt(i)),
          apparent_temperature: HOURS.map((_, i) => tempAt(i) - 3),
          // Saturday: rain 14–18 Uhr.
          precipitation: HOURS.map((_, i) => (i >= 48 + 14 && i < 48 + 18 ? 1.1 : 0)),
          precipitation_probability: HOURS.map((_, i) => (i >= 48 + 14 && i < 48 + 18 ? 90 : 5)),
          wind_speed_10m: HOURS.map(() => 12),
          wind_gusts_10m: HOURS.map(() => 25),
          relative_humidity_2m: HOURS.map(() => 80),
          uv_index: HOURS.map(() => 1),
          is_day: HOURS.map((_, i) => (i % 24 >= 8 && i % 24 < 17 ? 1 : 0)),
          weather_code: HOURS.map((_, i) => (i >= 48 + 14 && i < 48 + 18 ? 61 : 3)),
          cloud_cover: HOURS.map(() => 90),
        },
        daily: {
          time: DAYS,
          weather_code: [3, 3, 61, 3, 3, 3, 3],
          temperature_2m_max: MAX,
          temperature_2m_min: MIN,
          precipitation_probability_max: [5, 5, 90, 5, 5, 5, 5],
          apparent_temperature_max: MAX.map((t) => t - 3),
          apparent_temperature_min: MIN.map((t) => t - 3),
          precipitation_sum: [0, 0, 4.4, 0, 0, 0, 0],
          wind_speed_10m_max: [20, 21, 22, 23, 24, 25, 26],
          wind_gusts_10m_max: [40, 41, 42, 43, 44, 45, 46],
          uv_index_max: [1, 1, 1, 1, 1, 1, 1],
          sunrise: DAYS.map((d) => `${d}T07:44`),
          sunset: DAYS.map((d) => `${d}T16:20`),
          sunshine_duration: [3600, 3600, 0, 7200, 3600, 3600, 3600],
        },
      },
    }),
  );
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

const LONG = [
  'Donnerstag, 26. November',
  'Freitag, 27. November',
  'Samstag, 28. November',
  'Sonntag, 29. November',
  'Montag, 30. November',
  'Dienstag, 1. Dezember',
  'Mittwoch, 2. Dezember',
];
const WEEKDAY = ['Donnerstag', 'Freitag', 'Samstag', 'Sonntag', 'Montag', 'Dienstag', 'Mittwoch'];

test.describe('Weather days and hours (round 2, package C)', () => {
  test.beforeEach(async ({ page }) => {
    await mockWeek(page);
    await choosePlace(page);
  });

  test('keyboard only: through seven days and back, each with its own head, cards, curve and moon', async ({
    page,
  }) => {
    await ready(page, '/weather');
    const days = page.getByRole('radiogroup', { name: 'Tag wählen' });
    const today = days.getByRole('radio', { checked: true });
    await expect(today).toHaveAccessibleName(/^Heute/);
    // One tab stop per group: Tab from the stepper's "›" leads into the hours, then to the days' checked row.
    await page.getByTestId('weather-step-next').focus();
    await expect(page.getByTestId('weather-step-prev')).toHaveAttribute('aria-disabled', 'true');
    await today.focus();
    const moons: string[] = [];
    for (let d = 1; d < 7; d++) {
      await page.keyboard.press('ArrowDown');
      await expect(page).toHaveURL(new RegExp(`day=${DAYS[d]}`));
      // Focus stays on the control that was used.
      await expect(days.getByRole('radio', { checked: true })).toBeFocused();
      const now = page.getByTestId('weather-now');
      await expect(now).toContainText(`${MAX[d]}° / ${MIN[d]}°`);
      await expect(now).toContainText(LONG[d]!);
      await expect(page.getByTestId('weather-step-label')).toContainText(WEEKDAY[d]!);
      await expect(page.getByTestId('weather-hours').locator('label')).toHaveCount(24);
      await expect(page.getByTestId('weather-hours').locator('label').first()).toContainText(
        '00:00',
      );
      await expect(page.getByRole('heading', { name: `Verlauf am ${WEEKDAY[d]}` })).toBeVisible();
      await expect(page.getByTestId('weather-live')).toHaveText(
        `${LONG[d]}: ${d === 2 ? 'leichter Regen' : 'bedeckt'}, ${MAX[d]}° / ${MIN[d]}°`,
      );
      moons.push((await page.getByTestId('weather-moon').textContent()) ?? '');
    }
    // The moon card follows the date: rise and set differ from day to day.
    expect(new Set(moons).size).toBeGreaterThan(3);
    await expect(page.getByTestId('weather-step-next')).toHaveAttribute('aria-disabled', 'true');
    // Saturday's chips and its hint of rain.
    await page.keyboard.press('Home');
    await expect(page).toHaveURL(/\/weather$|\/weather\?$/);
    await expect(page.getByTestId('weather-now')).toContainText('fühlt sich an wie 0°');
    // "Heute" returns: step on with the keyboard, then press it.
    await page.getByTestId('weather-step-next').focus();
    // Two quick presses are two days, also before the page has followed the first.
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`day=${DAYS[2]}`));
    await expect(page.getByTestId('weather-keys')).toContainText('Regen 14–18 Uhr · 4,4 mm');
    await page.getByTestId('weather-step-today').focus();
    await page.keyboard.press('Enter');
    await expect(page).not.toHaveURL(/day=/);
    await expect(page.getByTestId('weather-step-today')).toHaveCount(0);
    await expect(page.getByTestId('weather-step-label')).toHaveText(/^Heute, Do\.? 26\. Nov\.$/);
  });

  test('hours: arrow keys choose an hour, the head shows it, "Ganzer Tag" goes back', async ({
    page,
  }) => {
    await ready(page, '/weather?day=2026-11-28');
    const hours = page.getByRole('radiogroup', { name: 'Stunde wählen' });
    await expect(hours.getByRole('radio', { checked: true })).toHaveCount(0);
    await hours.locator('label').nth(14).click();
    await expect(page).toHaveURL(/day=2026-11-28&hour=14/);
    await expect(page.getByTestId('weather-now')).toContainText(/Sa\.? 14:00 · fühlt sich an wie/);
    await page.keyboard.press('ArrowRight');
    await expect(page).toHaveURL(/hour=15/);
    await expect(hours.getByRole('radio', { checked: true })).toBeFocused();
    await expect(page.getByTestId('weather-hour-line')).toContainText('Werte um 15:00');
    await expect(page.getByTestId('weather-chart-marker')).toBeAttached();
    await expect(page.getByTestId('weather-live')).toHaveText('Samstag 15:00: leichter Regen, 3°');
    await page.getByTestId('weather-hour-back').click();
    await expect(page).toHaveURL(/day=2026-11-28$/);
    await expect(page.getByTestId('weather-hour-back')).toHaveCount(0);
  });

  test('Back from another day returns to now with one press', async ({ page }) => {
    await ready(page, '/weather');
    const next = page.getByTestId('weather-step-next');
    for (let i = 0; i < 4; i++) await next.click();
    await expect(page).toHaveURL(/day=2026-11-30/);
    await page.goBack();
    await expect(page).not.toHaveURL(/day=/);
    await expect(page.getByTestId('weather-now')).toContainText('fühlt sich an wie 0°');
    await expect(page.getByTestId('weather-step-label')).toHaveText(/^Heute, Do\.? 26\. Nov\.$/);
  });

  test('the address: a link opens its day and hour; a day outside the week falls back to now', async ({
    page,
  }) => {
    await ready(page, '/weather?day=2026-11-29&hour=08');
    await expect(page.getByTestId('weather-now')).toContainText(/So\.? 08:00/);
    await expect(
      page.getByRole('radiogroup', { name: 'Tag wählen' }).getByRole('radio', { checked: true }),
    ).toHaveAccessibleName(/^So/);
    await ready(page, '/weather?day=2026-12-09&hour=08');
    await expect(page).not.toHaveURL(/day=|hour=/);
    await expect(page.getByTestId('weather-now')).toContainText('fühlt sich an wie 0°');
    await ready(page, '/weather?day=2026-11-28&hour=99');
    await expect(page).toHaveURL(/day=2026-11-28$/);
    await expect(page.getByTestId('weather-now')).toContainText('Samstag, 28. November');
  });

  test('a day beyond five days: no air forecast yet, one sentence', async ({ page }) => {
    await ready(page, '/weather?day=2026-12-02');
    await expect(page.getByTestId('weather-air-missing')).toHaveText(
      'Für diesen Tag liegt noch keine Luftvorhersage vor.',
    );
  });

  test('change of picture: a 200 ms fade, none with reduced motion', async ({ page }) => {
    await ready(page, '/weather');
    await page.getByTestId('weather-step-next').click();
    await expect(page.getByTestId('weather-scene-fade')).toBeAttached();
    await expect(page.getByTestId('weather-scene-fade')).toHaveCount(0);
    // Stepping never starts the opening motion.
    await expect(page.getByTestId('weather-scene')).not.toHaveAttribute('data-motion', /.+/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByTestId('weather-step-next').click();
    await expect(page).toHaveURL(/day=2026-11-28/);
    await expect(page.getByTestId('weather-scene-fade')).toHaveCount(0);
  });

  test('swipe on the picture steps a day (phone)', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'touch profile only');
    await ready(page, '/weather');
    const box = (await page.getByTestId('module-frame').boundingBox())!;
    const swipe = (from: number, to: number) =>
      page.evaluate(
        ({ from, to, y }) => {
          const el = document.querySelector('[data-testid="weather-scene"]')!;
          const touch = (x: number) =>
            new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
          el.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(from)], bubbles: true }));
          el.dispatchEvent(
            new TouchEvent('touchend', { changedTouches: [touch(to)], bubbles: true }),
          );
        },
        { from, to, y: box.y + box.height / 2 },
      );
    await swipe(300, 150);
    await expect(page).toHaveURL(/day=2026-11-27/);
    await expect(page.getByTestId('weather-step-label')).toHaveText('Freitag, 27. Nov.');
    await swipe(150, 300);
    await expect(page).not.toHaveURL(/day=/);
    await expect(page.getByTestId('weather-step-label')).toHaveText(/^Heute/);
    // From the edge (the system's back gesture): nothing.
    await swipe(10, 200);
    await expect(page).not.toHaveURL(/day=/);
  });
});
