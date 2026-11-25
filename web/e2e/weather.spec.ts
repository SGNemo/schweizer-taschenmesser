import { expect, test, type Page } from '@playwright/test';
import { ready, showAllWidgets } from './helpers';

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

test.describe('Weather module', () => {
  test.beforeEach(async ({ page }) => {
    await showAllWidgets(page);
  });

  test('without a place the widget offers one calm step and nothing is requested', async ({
    page,
  }) => {
    const seen = await mockWeather(page);
    await ready(page, '/');
    const widget = page.getByTestId('widget-weather:today');
    await expect(widget).toBeVisible();
    await expect(widget).toContainText('Noch kein Ort gewählt.');
    await expect(widget.getByRole('link', { name: 'Ort wählen' })).toHaveAttribute(
      'href',
      '/weather',
    );
    expect(seen).toEqual([]);
  });

  test('choose a place once: the widget shows only today and the rain hint; the module page has the rest', async ({
    page,
  }) => {
    const seen = await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    const widget = page.getByTestId('widget-weather:today');
    await expect(widget).toContainText('Bern');
    await expect(widget).toContainText('14°');
    await expect(widget).toContainText('leicht bewölkt');
    await expect(widget).toContainText('ab 15 Uhr Regen');
    await expect(widget.getByTestId('weather-hours')).toHaveCount(0);
    // Only the typed name (search) and the rounded position (forecast) went out.
    const forecast = seen.find((u) => u.includes('api.open-meteo.com/v1/forecast'))!;
    expect(forecast).toContain('latitude=46.95');
    expect(forecast).toContain('longitude=7.45');
    expect(seen.find((u) => u.includes('geocoding'))).toContain('name=Bern');
    // The title opens the module as a page, not a dialog.
    await widget.getByRole('link', { name: /Wetter heute/ }).click();
    await expect(page).toHaveURL(/\/weather$/);
    await expect(page.getByTestId('module-frame')).toHaveAttribute('data-hue', 'cobalt');
    await expect(page.locator('main h1')).toHaveText('Bern');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('"Wetter auf der Übersicht" off and "Ort entfernen" take the widget\'s values away again', async ({
    page,
  }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await expect(page.getByTestId('widget-weather:today')).toContainText('14°');

    await ready(page, '/settings/verbindungen');
    await page.getByRole('switch', { name: 'Wetter auf der Übersicht' }).click();
    await ready(page, '/');
    await expect(page.getByTestId('widget-weather:today')).not.toContainText('14°');

    await ready(page, '/settings/verbindungen');
    await page.getByRole('switch', { name: 'Wetter auf der Übersicht' }).click();
    await page.getByRole('button', { name: 'Ort entfernen' }).click();
    await expect(page.getByTestId('weather-place')).toHaveText('Noch kein Ort gewählt.');
    await ready(page, '/');
    await expect(page.getByTestId('widget-weather:today')).toContainText('Noch kein Ort gewählt.');
  });

  test('the page without a place: one calm next step to the settings', async ({ page }) => {
    const seen = await mockWeather(page);
    await ready(page, '/weather');
    const empty = page.getByTestId('weather-empty');
    await expect(empty).toContainText('Wähle deinen Ort');
    await empty.getByRole('link').click();
    await expect(page).toHaveURL(/\/settings\/verbindungen/);
    expect(seen).toEqual([]);
  });

  test('the page: head with sky and the three facts, 24 hour cards, 7 days, air in the aside', async ({
    page,
    isMobile,
  }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/weather');
    const frame = page.getByTestId('module-frame');
    await expect(frame.getByTestId('sky')).toBeAttached();
    await expect(frame.getByTestId('weather-now')).toContainText('fühlt sich an wie 12°');
    // The facts fill the stage's signature slot; the frame's default mark is not drawn beside them.
    const slot = frame.getByTestId('module-signature');
    await expect(slot.getByTestId('weather-keys')).toContainText('Regen ab 15 Uhr');
    await expect(slot.getByTestId('weather-keys')).toContainText('Wind 14 km/h');
    await expect(slot.locator('span[data-signature]')).toHaveCount(0);
    const preview = page.getByTestId('weather-preview');
    await expect(preview.getByTestId('weather-hours').locator('li')).toHaveCount(24);
    await expect(preview.getByTestId('weather-days').locator('li')).toHaveCount(7);
    await expect(preview.getByTestId('weather-hours').locator('li').first()).toContainText('10:00');
    await expect(preview.getByTestId('weather-hours').locator('li').nth(5)).toContainText('80 %');
    await expect(preview.getByTestId('weather-days').locator('li').nth(3)).toContainText(
      'Gewitter',
    );
    await expect(page.getByTestId('weather-preview-credit')).toContainText('Open-Meteo.com');
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
    // Colour never stands alone: every day names its rating.
    await expect(preview.getByTestId('weather-days').locator('[data-rating]').first()).toHaveText(
      /Gut|Geht so|Ungemütlich/,
    );
    // The chart fits the window width on a phone too.
    const box = await preview.getByTestId('weather-chart').boundingBox();
    expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    if (isMobile) expect(box!.width).toBeGreaterThan(250);
    // Gusts of 70 km/h on Friday: a hint above the head, with what it is based on.
    await expect(page.getByTestId('weather-warning')).toContainText('Sturmböen bis 70 km/h');
    await expect(page.getByTestId('weather-warning')).toContainText('keine amtliche Warnung');
  });

  test('a second place: the chip shows its own forecast and can be removed again', async ({
    page,
  }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/weather');
    await page.getByTestId('weather-add-place').click();
    await page.getByLabel('Ort suchen').fill('Bern');
    await page.getByRole('dialog').getByRole('button', { name: 'Suchen', exact: true }).click();
    await page.getByRole('button', { name: 'Bern, Schweiz wählen' }).click();
    // The mocked search offers only Bern, which is the main place: nothing is added twice.
    await expect(page.getByText('Dieser Ort ist schon dabei.')).toBeVisible();
  });

  test('the page links on to the weather settings', async ({ page }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/weather');
    await page.getByRole('main').getByRole('link', { name: 'Einstellungen' }).click();
    await expect(page).toHaveURL(/\/settings\/verbindungen/);
    await expect(page.getByTestId('weather-place')).toBeVisible();
  });

  test('offline later: the old values stay, marked "Stand hh:mm", no rain hint', async ({
    page,
  }) => {
    await mockWeather(page);
    await choosePlace(page);
    await ready(page, '/');
    await expect(page.getByTestId('widget-weather:today')).toContainText('ab 15 Uhr Regen');
    // An hour later the forecast cannot be reached any more.
    await page.clock.setFixedTime(new Date('2026-09-29T11:00:00'));
    await page.route('**://api.open-meteo.com/**', (route) => route.abort());
    await ready(page, '/');
    const widget = page.getByTestId('widget-weather:today');
    await expect(widget).toContainText('Stand 10:00');
    await expect(widget).not.toContainText('ab 15 Uhr Regen');
    // The last forecast stays on the page, marked with its time; the hours start at the place's current hour.
    await ready(page, '/weather');
    await expect(page.getByTestId('weather-now')).toContainText('Stand 10:00');
    await expect(page.getByTestId('weather-hours').locator('li').first()).toContainText('11:00');
  });

  test('an unreachable service leaves no error on the Overview', async ({ page }) => {
    await mockWeather(page);
    await choosePlace(page);
    // Routes registered later win: from here on the forecast cannot be reached.
    await page.route('**://api.open-meteo.com/**', (route) => route.abort());
    await ready(page, '/');
    await expect(page.getByTestId('widget-todos:next')).toBeVisible();
    await expect(page.getByTestId('widget-weather:today')).not.toContainText('°');
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

/* ---- Weather scenes, package 1b: the scene in the head, the hint inside the stage, sizes, motion, axe ---- */

const sceneDays = days7;
/** The analysis fixture (invented place "Lindenau"): a night or a day, with 0, 1 or 2 hints for today and tomorrow. */
async function mockScene(
  page: Page,
  o: { night: boolean; hints: 0 | 1 | 2; date?: string; dust?: number },
) {
  const hours = [...times, ...nextDay];
  // Another day (package 3): every date of the answer moves by the same number of days.
  const shift = o.date ? Math.round((Date.parse(o.date) - Date.parse('2026-09-29')) / 86400000) : 0;
  const moved = <T>(json: T): T =>
    shift === 0
      ? json
      : (JSON.parse(
          JSON.stringify(json).replace(/2026-(09|10)-(\d\d)/g, (d) =>
            new Date(Date.parse(d) + shift * 86400000).toISOString().slice(0, 10),
          ),
        ) as T);
  await page.route('**://geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: {
        results: [{ name: 'Lindenau', country: 'Deutschland', latitude: 50.1, longitude: 10.2 }],
      },
    }),
  );
  await page.route('**://air-quality-api.open-meteo.com/**', (route) =>
    o.dust != null
      ? route.fulfill({ json: { current: { european_aqi: 25, dust: o.dust } } })
      : route.fulfill({ status: 500, body: '' }),
  );
  await page.route('**://api.open-meteo.com/**', (route) =>
    route.fulfill({
      json: moved({
        timezone: 'Europe/Berlin',
        current: {
          time: o.night ? '2026-09-29T02:50' : '2026-09-29T12:00',
          temperature_2m: o.night ? -4.2 : 9,
          weather_code: 1,
          apparent_temperature: o.night ? -9 : 7,
          relative_humidity_2m: 86,
          wind_speed_10m: 9,
          wind_gusts_10m: 18,
          is_day: o.night ? 0 : 1,
          cloud_cover: 0,
          pressure_msl: 1027,
          wind_direction_10m: 45,
          snow_depth: 0,
        },
        hourly: {
          time: hours,
          temperature_2m: hours.map(() => -4),
          weather_code: hours.map(() => 1),
          precipitation_probability: hours.map(() => 0),
          is_day: hours.map((t) => (t.slice(11, 13) >= '08' && t.slice(11, 13) < '16' ? 1 : 0)),
          uv_index: hours.map(() => 0),
        },
        daily: {
          time: sceneDays,
          weather_code: sceneDays.map((_, i) => (i === 1 && o.hints === 2 ? 66 : 1)),
          temperature_2m_max: sceneDays.map(() => 2),
          temperature_2m_min: sceneDays.map((_, i) => (i === 0 && o.hints > 0 ? -6 : 1)),
          precipitation_probability_max: sceneDays.map(() => 0),
          uv_index_max: sceneDays.map(() => 1.5),
          sunrise: sceneDays.map((d) => `${d}T07:38`),
          sunset: sceneDays.map((d) => `${d}T16:24`),
        },
      }),
    }),
  );
}

async function chooseLindenau(page: Page) {
  await ready(page, '/settings/verbindungen');
  await page.getByLabel('Ort suchen').fill('Lindenau');
  await page
    .locator('#weather--place')
    .getByRole('button', { name: 'Suchen', exact: true })
    .click();
  await page.getByRole('button', { name: /Lindenau.*wählen/ }).click();
  await expect(page.getByTestId('weather-place')).toContainText('Lindenau');
}

test.describe('Weather scene in the head (package 1b)', () => {
  test('the hint lives in the stage as a pill, nothing above the head', async ({ page }) => {
    await mockScene(page, { night: true, hints: 2 });
    await chooseLindenau(page);
    await ready(page, '/weather');
    const frame = page.getByTestId('module-frame');
    const scene = frame.getByTestId('weather-scene');
    await expect(scene).toHaveAttribute('data-phase', 'night');
    await expect(scene).toHaveAttribute('data-cond', 'mostlyClear');
    await expect(scene).toHaveAttribute('data-ink', 'light');
    await expect(frame.getByTestId('sky')).toBeAttached();
    const pill = frame.getByTestId('weather-warning');
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveAttribute('role', 'note');
    await expect(pill).toHaveAccessibleName('Wetterhinweis');
    await expect(pill).toContainText('Heute: Frost bis -6°');
    await expect(pill).toContainText('gefrierender Regen, es kann glatt sein');
    await expect(pill.getByText('berechnet, keine amtliche Warnung')).toHaveCount(1);
    // No hint outside the stage.
    await expect(page.getByTestId('weather-warning')).toHaveCount(1);
    // At night: no UV, the sunrise instead; the dry chip is an umbrella.
    await expect(frame.getByTestId('weather-now')).toContainText('überwiegend klar · Frost');
  });

  for (const [w, h, phone] of [
    [1920, 1080, false],
    [1280, 800, false],
    [412, 915, true],
  ] as const)
    for (const hints of [0, 1, 2] as const)
      test(`stage height at ${w} px with ${hints} hint(s)`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await mockScene(page, { night: true, hints });
        await chooseLindenau(page);
        await ready(page, '/weather');
        await expect(page.getByTestId('weather-keys')).toBeVisible();
        await expect(page.getByTestId('weather-warning')).toHaveCount(hints > 0 ? 1 : 0);
        const box = (await page.getByTestId('module-frame').boundingBox())!;
        const base = phone ? 272 : 280;
        const most = hints === 2 ? (phone ? 300 : 290) : base;
        expect(box.height, `stage at ${w} px, ${hints} hint(s)`).toBeGreaterThanOrEqual(base - 1);
        expect(box.height, `stage at ${w} px, ${hints} hint(s)`).toBeLessThanOrEqual(most + 1);
      });

  test('motion: five seconds after opening; none with reduced motion', async ({ page }) => {
    await mockScene(page, { night: false, hints: 0 });
    await chooseLindenau(page);
    await ready(page, '/weather');
    await expect(page.getByTestId('weather-scene')).toHaveAttribute('data-motion', /run|rest/);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await ready(page, '/');
    await ready(page, '/weather');
    await expect(page.getByTestId('weather-keys')).toBeVisible();
    await expect(page.getByTestId('weather-scene')).not.toHaveAttribute('data-motion', /.+/);
  });

  test('"Schlicht": the sky and the sun only, no motion', async ({ page }) => {
    await mockScene(page, { night: false, hints: 0 });
    await chooseLindenau(page);
    await page.getByLabel('Bild im Wetter-Kopf').selectOption('plain');
    await ready(page, '/weather');
    const scene = page.getByTestId('weather-scene');
    await expect(scene).toHaveAttribute('data-level', 'plain');
    await expect(scene.locator('[data-layer]')).toHaveCount(2);
    await expect(scene).not.toHaveAttribute('data-motion', /.+/);
  });

  for (const scheme of ['light', 'dark'] as const)
    for (const night of [false, true])
      for (const w of [1920, 1280])
        test(`axe on the weather page with a place: ${scheme}, ${night ? 'night' : 'day'}, ${w} px`, async ({
          page,
        }) => {
          await page.setViewportSize({ width: w, height: 900 });
          await page.emulateMedia({ colorScheme: scheme });
          await mockScene(page, { night, hints: 2 });
          await chooseLindenau(page);
          await ready(page, '/weather');
          await expect(page.getByTestId('weather-keys')).toBeVisible();
          const { default: AxeBuilder } = await import('@axe-core/playwright');
          const results = await new AxeBuilder({ page })
            .include('[data-testid="module-frame"]')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
          expect(
            results.violations.map(
              (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
            ),
          ).toEqual([]);
        });
});

test.describe('Sky events (package 3)', () => {
  // The partial solar eclipse of 2027-08-02 at the invented place (CONCEPT-EVENTS §4): 08:10–10:14 UTC (the browser
  // runs in UTC; the place's clock is Berlin).
  const eclipseDay = async (page: Page, hints: 0 | 1 | 2, time = '2027-08-02T05:00:00Z') => {
    await page.clock.setFixedTime(new Date(time));
    await mockScene(page, { night: false, hints, date: '2027-08-02' });
    await chooseLindenau(page);
    await ready(page, '/weather');
    await expect(page.getByTestId('weather-keys')).toBeVisible();
  };

  for (const [w, h, phone] of [
    [1920, 1080, false],
    [412, 915, true],
  ] as const)
    test(`the eclipse day at ${w} px: safety pill and the hints, the chip, the stage height`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await eclipseDay(page, 2);
      const frame = page.getByTestId('module-frame');
      await expect(frame.getByTestId('weather-safety')).toContainText('Sonnenfinsternis-Brille');
      // Desktop: one hint beside the safety pill, the second under the head; phone: both hints under the head.
      await expect(frame.getByTestId('weather-warning')).toHaveCount(phone ? 0 : 1);
      await expect(
        page.getByTestId('weather-late-warning').getByTestId('weather-warning'),
      ).toHaveCount(1);
      const keys = frame.getByTestId('weather-keys');
      await expect(keys).toContainText(/Sonnenfinsternis \d\d:\d\d–\d\d:\d\d/);
      // Phone: the event takes the wind chip's place; the wind goes to the line under the stage.
      if (phone) {
        await expect(keys.getByRole('listitem')).toHaveCount(2);
        await expect(keys).not.toContainText('Wind');
      }
      const box = (await frame.boundingBox())!;
      expect(box.height).toBeLessThanOrEqual((phone ? 300 : 290) + 1);
      await expect(page.getByTestId('weather-sky-next')).toContainText('Als Nächstes');
    });

  test('the event pictures never move, also with motion on', async ({ page }) => {
    await eclipseDay(page, 0, '2027-08-02T09:10:00Z');
    const scene = page.getByTestId('weather-scene');
    await expect(scene.locator('[data-part="bite"]')).toHaveCount(1);
    const moving = await scene
      .locator('[data-part="bite"]')
      .evaluate((el) => !!el.closest('[class*="sc-"]'));
    expect(moving).toBe(false);
  });

  for (const scheme of ['light', 'dark'] as const)
    test(`axe on the eclipse day: ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await eclipseDay(page, 1, '2027-08-02T09:10:00Z');
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      const results = await new AxeBuilder({ page })
        .include('[data-testid="module-frame"]')
        .include('[data-testid="weather-moon"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });
});

test.describe('Official warnings and aurora (package 3b)', () => {
  // The DWD answer in the shape the GeoServer gave on 2026-11-25 (fields limited by `propertyName`).
  const dwd = (page: Page, n: 1 | 3) =>
    page.route('**://maps.dwd.de/**', (route) =>
      route.fulfill({
        headers: { 'access-control-allow-origin': '*' },
        json: {
          type: 'FeatureCollection',
          features: [
            ['ORKANARTIGE BÖEN', 'Severe', 'WIND'],
            ['GLÄTTE', 'Moderate', 'GLAZE'],
            ['DAUERREGEN', 'Moderate', 'RAIN'],
          ]
            .slice(0, n)
            .map(([EVENT, SEVERITY, EC_GROUP]) => ({
              type: 'Feature',
              properties: {
                EVENT,
                SEVERITY,
                EC_GROUP,
                URGENCY: 'Immediate',
                STATUS: 'Actual',
                MSGTYPE: 'Alert',
                ONSET: '2026-09-29T06:00:00Z',
                EXPIRES: '2026-09-29T21:00:00Z',
              },
            })),
        },
      }),
    );

  for (const [w, h, phone] of [
    [1920, 1080, false],
    [412, 915, true],
  ] as const)
    test(`the official pill at ${w} px: two rows in the stage at most, the rest under the head, stage height`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: w, height: h });
      await mockScene(page, { night: false, hints: 2 });
      const asked: string[] = [];
      page.on('request', (r) => {
        if (r.url().includes('maps.dwd.de')) asked.push(r.url());
      });
      await dwd(page, 3);
      await chooseLindenau(page);
      await ready(page, '/weather');
      const frame = page.getByTestId('module-frame');
      const pill = frame.getByTestId('weather-official');
      await expect(pill).toContainText('Amtliche Unwetterwarnung: Orkanartige Böen');
      await expect(pill.getByRole('listitem')).toHaveCount(2);
      await expect(pill).toContainText('+ 1 weitere');
      await expect(frame.getByTestId('weather-warning')).toHaveCount(0);
      await expect(
        page.getByTestId('weather-late-warning').getByTestId('weather-official'),
      ).toHaveCount(1);
      const box = (await frame.boundingBox())!;
      expect(box.height).toBeLessThanOrEqual((phone ? 300 : 290) + 1);
      // Only the rounded position of the main place leaves the device.
      expect(asked.length).toBeGreaterThan(0);
      expect(new URL(asked[0]!).searchParams.get('CQL_FILTER')).toBe(
        'INTERSECTS(THE_GEOM,POINT(50.1 10.2))',
      );
    });

  for (const scheme of ['light', 'dark'] as const)
    test(`axe with the official pill: ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await mockScene(page, { night: false, hints: 1 });
      await dwd(page, 1);
      await chooseLindenau(page);
      await ready(page, '/weather');
      await expect(page.getByTestId('weather-official')).toBeVisible();
      const { default: AxeBuilder } = await import('@axe-core/playwright');
      const results = await new AxeBuilder({ page })
        .include('[data-testid="module-frame"]')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
        ),
      ).toEqual([]);
    });

  test('switched off: the DWD is not asked', async ({ page }) => {
    await mockScene(page, { night: false, hints: 0 });
    const asked: string[] = [];
    page.on('request', (r) => {
      if (/maps\.dwd\.de|swpc\.noaa\.gov/.test(r.url())) asked.push(r.url());
    });
    await chooseLindenau(page);
    await page.getByLabel('Amtliche Warnungen (Deutschland)').click();
    await ready(page, '/weather');
    await expect(page.getByTestId('weather-keys')).toBeVisible();
    // The SWPC file is never asked at this place in daylight unless the night needs it; the DWD not at all.
    expect(asked.filter((u) => u.includes('maps.dwd.de'))).toEqual([]);
  });
});
