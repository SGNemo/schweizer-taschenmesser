import { mkdirSync } from 'node:fs';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ready } from '../helpers';

/**
 * Weather pictures for PR texts (manual tooling, not CI; howto: docs/howto/pr-screenshots.md). Every situation is
 * one row of SCENARIOS: the instant, the place, the forecast now, optional DWD warnings, Kp forecast and dust. The
 * network is mocked completely, the clock is fixed and the browser runs in the place's time zone, so every run gives
 * the same pictures.
 *
 * Usage (in web/): `npm run screenshots -- --project=weather`
 *   WEATHER_SCENES=eclipse|aurora   regex on the scenario id (default: all)
 *   WEATHER_PARTS=head,card         head | card | air | days | overview | widget | page (default: head,card)
 *   SCREENS_VIEWPORTS=1920x1080     default 1920x1080,412x915
 *   SCREENS_SCHEME=dark             default light and dark
 *   SCREENS_DIR=.screens/weather    output directory
 *   WEATHER_SCENARIO='{"id":"x","utc":"…","local":"…"}'  one extra scenario as JSON (same fields as below)
 * Then lay them out: `node e2e/screenshots/montage.mjs .screens/weather head-1920-light 1920 1 out.png`.
 */

type Warn = [event: string, severity: 'Moderate' | 'Severe' | 'Extreme', group: string];
interface Scenario {
  id: string;
  /** The real instant (UTC, with Z) – the browser clock is fixed to it. */
  utc: string;
  /** The place's local wall time of the same instant, `YYYY-MM-DDTHH:mm` (the forecast's "now"). */
  local: string;
  lat?: number;
  lon?: number;
  tz?: string;
  /** WMO code now and for the days (default 1 = überwiegend klar). */
  code?: number;
  day?: 0 | 1;
  temp?: number;
  cloud?: number;
  gust?: number;
  min?: number;
  max?: number;
  sunrise?: string;
  sunset?: string;
  /** µg/m³ Saharan dust now. */
  dust?: number;
  /** DWD warnings the mocked GeoServer answers with (main place in Germany only). */
  warn?: Warn[];
  /** Kp of every step of the mocked SWPC file (aurora needs Kp 7 at the default place). */
  kp?: number;
}

/** Lindenau (invented, 49.6° N 11.0° E, Europe/Berlin): the round's sample place. */
const BASE = { lat: 49.6, lon: 11.0, tz: 'Europe/Berlin' };

/**
 * Handy instants (all checked in the weather scenes rounds, see docs/features/weather.md): the moon's picture moment,
 * eclipses, meteor nights, an aurora night and plain weather by day and night.
 */
const SCENARIOS: Scenario[] = [
  {
    id: 'day-clear',
    utc: '2026-06-10T10:00:00Z',
    local: '2026-06-10T12:00',
    day: 1,
    temp: 24,
    sunrise: '05:15',
    sunset: '21:20',
  },
  {
    id: 'day-rain',
    utc: '2026-06-10T10:00:00Z',
    local: '2026-06-10T12:00',
    day: 1,
    code: 63,
    cloud: 95,
    temp: 14,
    sunrise: '05:15',
    sunset: '21:20',
  },
  {
    id: 'day-snow',
    utc: '2026-01-15T11:00:00Z',
    local: '2026-01-15T12:00',
    day: 1,
    code: 73,
    cloud: 95,
    temp: -2,
    min: -6,
    sunrise: '08:05',
    sunset: '16:45',
  },
  {
    id: 'day-storm',
    utc: '2026-07-20T14:00:00Z',
    local: '2026-07-20T16:00',
    day: 1,
    code: 95,
    cloud: 90,
    gust: 80,
    temp: 27,
    sunrise: '05:30',
    sunset: '21:10',
  },
  {
    id: 'night-full-moon',
    utc: '2026-11-24T01:50:00Z',
    local: '2026-11-24T02:50',
    day: 0,
    temp: -4,
    min: -6,
    sunrise: '07:38',
    sunset: '16:24',
  },
  {
    id: 'eclipse-solar',
    utc: '2027-08-02T09:10:00Z',
    local: '2027-08-02T11:10',
    day: 1,
    sunrise: '05:50',
    sunset: '20:50',
  },
  {
    id: 'eclipse-lunar',
    utc: '2029-12-20T22:41:00Z',
    local: '2029-12-20T23:41',
    day: 0,
    sunrise: '08:10',
    sunset: '16:20',
  },
  {
    id: 'meteors',
    utc: '2028-12-13T23:30:00Z',
    local: '2028-12-14T00:30',
    day: 0,
    cloud: 10,
    sunrise: '08:05',
    sunset: '16:15',
  },
  {
    id: 'rainbow',
    utc: '2027-06-10T17:00:00Z',
    local: '2027-06-10T19:00',
    day: 1,
    code: 80,
    cloud: 70,
    sunrise: '05:15',
    sunset: '21:20',
  },
  {
    id: 'dust',
    utc: '2028-06-10T10:00:00Z',
    local: '2028-06-10T12:00',
    day: 1,
    dust: 86,
    sunrise: '05:15',
    sunset: '21:20',
  },
  {
    id: 'aurora',
    utc: '2026-11-25T21:00:00Z',
    local: '2026-11-25T22:00',
    day: 0,
    kp: 8,
    cloud: 20,
    sunrise: '07:40',
    sunset: '16:25',
  },
  {
    id: 'official-warnings',
    utc: '2026-11-25T12:00:00Z',
    local: '2026-11-25T13:00',
    day: 1,
    code: 2,
    min: -6,
    warn: [
      ['ORKANARTIGE BÖEN', 'Severe', 'WIND'],
      ['GLÄTTE', 'Moderate', 'GLAZE'],
      ['DAUERREGEN', 'Moderate', 'RAIN'],
    ],
    sunrise: '07:40',
    sunset: '16:25',
  },
];
if (process.env.WEATHER_SCENARIO)
  SCENARIOS.push(JSON.parse(process.env.WEATHER_SCENARIO) as Scenario);

const OUT = process.env.SCREENS_DIR ?? '.screens/weather';
const ONLY = process.env.WEATHER_SCENES ? new RegExp(process.env.WEATHER_SCENES) : undefined;
const PARTS = new Set((process.env.WEATHER_PARTS ?? 'head,card').split(','));
const VIEWPORTS = (process.env.SCREENS_VIEWPORTS ?? '1920x1080,412x915')
  .split(',')
  .map((v) => v.split('x').map(Number) as [number, number]);
const SCHEMES = (process.env.SCREENS_SCHEME?.split(',') ?? ['light', 'dark']) as (
  'light' | 'dark'
)[];

/** The Open-Meteo, DWD and SWPC answers of one scenario (7 days, 48 hours, all dates from the local "now"). */
async function mock(page: Page, s: Scenario & typeof BASE) {
  const d0 = Date.parse(`${s.local.slice(0, 10)}T12:00:00Z`);
  const dates = Array.from({ length: 7 }, (_, i) =>
    new Date(d0 + i * 864e5).toISOString().slice(0, 10),
  );
  const hours = dates
    .slice(0, 2)
    .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
  const code = s.code ?? 1;
  const day = s.day ?? 1;
  // Anything not mocked below never reaches the network (the specific routes, registered later, win).
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (r) => r.abort());
  await page.route('**://geocoding-api.open-meteo.com/**', (r) =>
    r.fulfill({
      json: {
        results: [{ name: 'Lindenau', country: 'Deutschland', latitude: s.lat, longitude: s.lon }],
      },
    }),
  );
  await page.route('**://air-quality-api.open-meteo.com/**', (r) =>
    r.fulfill({ json: { current: { european_aqi: 22, pm10: 14, pm2_5: 8, dust: s.dust ?? 3 } } }),
  );
  await page.route('**://api.open-meteo.com/**', (r) =>
    r.fulfill({
      json: {
        timezone: s.tz,
        current: {
          time: s.local,
          temperature_2m: s.temp ?? (day ? 19 : 4),
          weather_code: code,
          apparent_temperature: (s.temp ?? (day ? 19 : 4)) - 2,
          relative_humidity_2m: 70,
          wind_speed_10m: 12,
          wind_gusts_10m: s.gust ?? 25,
          is_day: day,
          cloud_cover: s.cloud ?? 10,
          pressure_msl: 1014,
          wind_direction_10m: 250,
          snow_depth: 0,
        },
        hourly: {
          time: hours,
          temperature_2m: hours.map(() => s.temp ?? 12),
          weather_code: hours.map(() => code),
          precipitation_probability: hours.map(() => (code >= 51 ? 70 : 0)),
          cloud_cover: hours.map(() => s.cloud ?? 10),
        },
        daily: {
          time: dates,
          weather_code: dates.map(() => code),
          temperature_2m_max: dates.map(() => s.max ?? 22),
          temperature_2m_min: dates.map(() => s.min ?? 9),
          precipitation_probability_max: dates.map(() => (code >= 51 ? 70 : 0)),
          wind_gusts_10m_max: dates.map(() => s.gust ?? 25),
          uv_index_max: dates.map(() => 4),
          sunrise: dates.map((d) => `${d}T${s.sunrise ?? '06:00'}`),
          sunset: dates.map((d) => `${d}T${s.sunset ?? '20:00'}`),
        },
      },
    }),
  );
  await page.route('**://maps.dwd.de/**', (r) =>
    r.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: {
        type: 'FeatureCollection',
        features: (s.warn ?? []).map(([EVENT, SEVERITY, EC_GROUP]) => ({
          type: 'Feature',
          properties: {
            EVENT,
            SEVERITY,
            EC_GROUP,
            URGENCY: 'Immediate',
            STATUS: 'Actual',
            MSGTYPE: 'Alert',
            ONSET: new Date(Date.parse(s.utc) - 6 * 3600e3).toISOString(),
            EXPIRES: new Date(Date.parse(s.utc) + 10 * 3600e3).toISOString(),
          },
        })),
      },
    }),
  );
  await page.route('**://services.swpc.noaa.gov/**', (r) =>
    r.fulfill({
      headers: { 'access-control-allow-origin': '*' },
      json: Array.from({ length: 24 }, (_, i) => ({
        time_tag: new Date(Date.parse(s.utc) - 24 * 3600e3 + i * 3 * 3600e3)
          .toISOString()
          .slice(0, 19),
        kp: s.kp ?? 2,
        observed: 'predicted',
        noaa_scale: null,
      })),
    }),
  );
}

async function open(
  browser: Browser,
  s: Scenario & typeof BASE,
  w: number,
  h: number,
  scheme: 'light' | 'dark',
) {
  // The browser runs in the place's zone: the clock reads like the place, `utc` stays the one true instant.
  const context = await browser.newContext({
    viewport: { width: w, height: h },
    colorScheme: scheme,
    reducedMotion: 'reduce', // a still picture: the 5 s of motion would land at a random frame
    timezoneId: s.tz,
    locale: 'de-DE',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  await page.clock.setFixedTime(new Date(s.utc));
  await mock(page, s);
  // `ready` skips the first-start assistant and waits for the app, like every e2e spec.
  await ready(page, '/settings/verbindungen');
  await page.getByLabel('Ort suchen').fill('Lindenau');
  await page
    .locator('#weather--place')
    .getByRole('button', { name: 'Suchen', exact: true })
    .click();
  await page.getByRole('button', { name: /Lindenau.*wählen/ }).click();
  await expect(page.getByTestId('weather-place')).toContainText('Lindenau');
  return { page, context };
}

for (const raw of SCENARIOS.filter((x) => !ONLY || ONLY.test(x.id)))
  for (const [w, h] of VIEWPORTS)
    for (const scheme of SCHEMES)
      test(`${raw.id} ${w} ${scheme}`, async ({ browser }) => {
        const s = { ...BASE, ...raw };
        mkdirSync(OUT, { recursive: true });
        const name = (part: string) => `${OUT}/${s.id}-${part}-${w}-${scheme}.png`;
        const { page, context } = await open(browser, s, w, h, scheme);
        if (PARTS.has('overview') || PARTS.has('widget')) {
          await ready(page, '/');
          // "Ruhig" shows only the first cards; "Ausführlich" brings the weather widget onto a fresh overview.
          await page
            .getByRole('radio', { name: 'Ausführlich' })
            .or(page.getByRole('button', { name: 'Ausführlich' }))
            .first()
            .click()
            .catch(() => undefined);
          // The widget loads after first paint (lazy chunk): wait for its scene or porthole, if it is on the overview.
          await page
            .locator('[data-variant="scene"], [data-variant="porthole"]')
            .first()
            .waitFor({ timeout: 5000 })
            .catch(() => undefined);
          await page.waitForTimeout(400);
          if (PARTS.has('overview')) await page.screenshot({ path: name('overview') });
          // The whole card (the frame's `[data-widget]` cell), not only its body.
          const widget = page.locator('[data-widget]:has([data-testid="weather-widget"])');
          if (PARTS.has('widget') && (await widget.count()))
            await widget.first().screenshot({ path: name('widget') });
        }
        await ready(page, '/weather');
        await expect(page.getByTestId('weather-keys')).toBeVisible();
        await page.waitForTimeout(400);
        if (PARTS.has('head')) {
          // The head plus whatever went under it (late or extra hints).
          const fr = (await page.getByTestId('module-frame').boundingBox())!;
          const below = await page.getByTestId('weather-late-warning').boundingBox();
          const bottom = Math.max(
            fr.y + fr.height,
            below && below.height > 0 ? below.y + below.height : 0,
          );
          await page.screenshot({
            path: name('head'),
            clip: { x: 0, y: 0, width: w, height: Math.ceil(bottom + 16) },
          });
        }
        const shot = async (part: string, testId: string) => {
          if (!PARTS.has(part)) return;
          const el = page.getByTestId(testId);
          if (await el.count()) await el.first().screenshot({ path: name(part) });
        };
        await shot('card', 'weather-moon');
        await shot('air', 'weather-air');
        await shot('days', 'weather-days');
        if (PARTS.has('page')) await page.screenshot({ path: name('page'), fullPage: true });
        await context.close();
      });
