// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
import { KP_KEY } from '@/core/sky/aurora';
import { setNow } from '@/core/time/now';
import { clearCache } from '@/core/weather/cache';
import {
  addExtraPlace,
  chooseWeatherPlace,
  setWeatherEnabled,
  setWeatherOfficial,
} from '@/core/weather/settings';
import {
  DWD_WARNINGS_PAGE,
  OFFICIAL_KEY,
  type OfficialWarning,
} from '@/core/weather/warningsOfficial';
import { AreaFrame } from '@/layout/AreaFrame';
import { tWeatherPage } from '@/strings.weatherPage';
import { setSettings } from '@/core/settings/settings';
import { toEpoch } from '@/core/time/dates';
import attention from '../attention';
import notifications from '../notifications';
import WeatherPage from '../routes/WeatherPage';

/**
 * Package 3b on the page (handoff/03b tests 3, 7): the official DWD pill for the main place, the replace rule, the
 * row counting with computed hints, "Jetzt wichtig", an extra place, and the aurora chip and card.
 * Sample place Lindenau (49.6° N, 11.0° E, in Germany); now 2026-11-25 12:00 UTC (13:00 in Berlin).
 */
const NOW = Date.parse('2026-11-25T12:00:00Z');
const dates = Array.from({ length: 7 }, (_, i) =>
  new Date(Date.parse('2026-11-25T12:00:00Z') + i * 864e5).toISOString().slice(0, 10),
);
const hours = dates
  .slice(0, 2)
  .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
function body(o: { gust?: number; min?: number; isDay?: 0 | 1; time?: string } = {}) {
  return {
    timezone: 'Europe/Berlin',
    current: {
      time: o.time ?? '2026-11-25T13:00',
      temperature_2m: 3,
      weather_code: 3,
      is_day: o.isDay ?? 1,
      cloud_cover: 20,
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map(() => 3),
      weather_code: hours.map(() => 3),
      precipitation_probability: hours.map(() => 0),
      cloud_cover: hours.map(() => 20),
    },
    daily: {
      time: dates,
      weather_code: dates.map(() => 3),
      temperature_2m_max: dates.map(() => 5),
      temperature_2m_min: dates.map((_, i) => (i === 0 ? (o.min ?? 1) : 1)),
      precipitation_probability_max: dates.map(() => 0),
      wind_gusts_10m_max: dates.map((_, i) => (i === 0 ? (o.gust ?? 20) : i === 1 ? 90 : 20)),
      sunrise: dates.map((d) => `${d}T07:40`),
      sunset: dates.map((d) => `${d}T16:25`),
    },
  };
}
let answer = body();
const stub = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string | URL | Request) =>
      String(url).includes('/v1/forecast')
        ? new Response(JSON.stringify(answer), { status: 200 })
        : new Response('{}', { status: 500 }),
    ),
  );
const renderPage = (path = '/weather') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AreaFrame>
        <WeatherPage />
      </AreaFrame>
    </MemoryRouter>,
  );
const official = (...w: Partial<OfficialWarning>[]) =>
  localStorage.setItem(
    OFFICIAL_KEY,
    JSON.stringify({
      key: '49.6,11',
      at: NOW,
      warnings: w.map((x) => ({
        event: 'Sturmböen',
        level: 2,
        kind: 'wind',
        onset: NOW - 3600000,
        expires: Date.parse('2026-11-25T22:00:00Z'),
        ...x,
      })),
    }),
  );
const SLOW = { timeout: 5000 };

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
  clearCache();
  setNow(() => NOW);
  answer = body();
  stub();
  await chooseWeatherPlace('Lindenau', 49.6, 11.0);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setNow();
});

describe('official warnings (package 3b)', () => {
  it("the pill: label by level, until, source link to the general DWD page; replaces today's computed wind", async () => {
    answer = body({ gust: 85, min: -6 }); // computed: wind today and frost today
    official({ event: 'Orkanartige Böen', level: 3 });
    const open = vi.spyOn(getPlatform().app, 'openUrl').mockResolvedValue(undefined);
    renderPage();
    const pill = await screen.findByTestId('weather-official', undefined, SLOW);
    expect(pill).toHaveAttribute('role', 'note');
    expect(pill).toHaveAccessibleName('Amtliche Warnung');
    expect(pill).toHaveTextContent('Amtliche Unwetterwarnung: Orkanartige Böen');
    expect(pill).toHaveTextContent('bis 23:00 · Quelle: DWD');
    expect(pill).not.toHaveTextContent('berechnet');
    fireEvent.click(within(pill).getByRole('button', { name: 'Quelle: DWD' }));
    expect(open).toHaveBeenCalledWith(DWD_WARNINGS_PAGE);
    // The computed wind of today is gone; the frost of another kind stays (one official + one computed row).
    const computed = within(screen.getByTestId('weather-now')).getByTestId('weather-warning');
    expect(computed).not.toHaveTextContent(/Sturmböen/);
    expect(computed).toHaveTextContent('Heute: Frost bis -6°');
  });

  it('at most two rows in the stage: three official warnings → two in the stage with "+ 1 weitere", one under the head', async () => {
    official(
      { event: 'Glätte', kind: 'ice', level: 2, expires: Date.parse('2026-11-25T20:00:00Z') },
      { event: 'Sturmböen', level: 2 },
      { event: 'Orkanartige Böen', level: 3 },
    );
    renderPage();
    const stage = await screen.findByTestId('weather-now', undefined, SLOW);
    const inStage = await within(stage).findByTestId('weather-official', undefined, SLOW);
    expect(within(inStage).getAllByRole('listitem')).toHaveLength(2);
    // Highest level first, then the earliest end.
    expect(within(inStage).getAllByRole('listitem')[0]).toHaveTextContent('Orkanartige Böen');
    expect(within(inStage).getAllByRole('listitem')[1]).toHaveTextContent('Glätte');
    expect(inStage).toHaveTextContent('+ 1 weitere');
    expect(within(stage).queryByTestId('weather-warning')).toBeNull();
    const below = within(screen.getByTestId('weather-late-warning')).getByTestId(
      'weather-official',
    );
    expect(below).toHaveTextContent('Sturmböen');
  });

  it('switched off, older than 60 minutes, or an extra place: no official pill, the computed hints in full', async () => {
    answer = body({ gust: 85 });
    official({});
    await setWeatherOfficial(false);
    renderPage();
    await screen.findByTestId('weather-keys', undefined, SLOW);
    expect(screen.queryByTestId('weather-official')).toBeNull();
    expect(screen.getByTestId('weather-now')).toHaveTextContent(/Heute: Sturmböen/);
    cleanup();
    await setWeatherOfficial(true);
    setNow(() => NOW + 61 * 60000);
    renderPage();
    await screen.findByTestId('weather-keys', undefined, SLOW);
    expect(screen.queryByTestId('weather-official')).toBeNull();
    cleanup();
    setNow(() => NOW);
    await addExtraPlace('Hof', 50.31, 11.92);
    renderPage('/weather?place=1');
    await screen.findByTestId('weather-keys', undefined, SLOW);
    expect(screen.queryByTestId('weather-official')).toBeNull();
  });

  it('"Jetzt wichtig": the official line with its label first; the computed hint of that kind today is left out', async () => {
    answer = body({ gust: 85, min: -6 });
    renderPage();
    await screen.findByTestId('weather-keys', undefined, SLOW);
    official({ event: 'Orkanartige Böen', level: 3 });
    const items = await attention({ today: '2026-11-25' });
    expect(items[0]).toMatchObject({
      id: 'weather:official:Orkanartige Böen',
      tone: 'warning',
      due: 'today',
      title: 'Amtliche Unwetterwarnung: Orkanartige Böen · bis 23:00',
    });
    expect(items.some((i) => i.id === 'weather:wind:2026-11-25')).toBe(false);
    expect(items.some((i) => i.id === 'weather:frost:2026-11-25')).toBe(true);
    // The morning notification leaves the replaced hint out too (official warnings send none in this package).
    await setSettings('module.weather', { warnNotify: true });
    setNow(() => toEpoch('2026-11-25', '06:00'));
    const morning = await notifications({
      from: toEpoch('2026-11-25', '07:00'),
      to: toEpoch('2026-11-25', '08:00'),
    });
    expect(morning).toHaveLength(1);
    expect(morning[0]!.body).toContain('Frost');
    expect(morning[0]!.body).not.toContain('Sturmböen');
  });
});

describe('official warnings ending on a later day', () => {
  it('"Jetzt wichtig" names the day as the pill does ("bis Do. 07:00")', async () => {
    official({ event: 'Glätte', kind: 'ice', expires: Date.parse('2026-11-26T06:00:00Z') });
    renderPage();
    await screen.findByTestId('weather-keys', undefined, SLOW);
    const items = await attention({ today: '2026-11-25' });
    expect(items[0]!.title).toMatch(/^Amtliche Warnung: Glätte · bis Do\.? 07:00$/);
    expect(screen.getByTestId('weather-official')).toHaveTextContent(/bis Do\.? 07:00/);
  });
});

describe('aurora (package 3b)', () => {
  it('weather switched off: the SWPC file is not asked, even on the page', async () => {
    setNow(() => Date.parse('2026-11-25T19:00:00Z'));
    const f = vi.fn(async (_url: string | URL | Request) => new Response('[]', { status: 200 }));
    vi.stubGlobal('fetch', f);
    await setWeatherEnabled(false);
    renderPage();
    // The page's own off state is there (its effects ran); then no SWPC request.
    expect(await screen.findByRole('status', undefined, SLOW)).toHaveTextContent(
      tWeatherPage.de.switchedOff,
    );
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('swpc'))).toEqual([]);
  });

  it('a strong night at the sample place: chip "Polarlicht möglich" and the card line with the hours and the source', async () => {
    setNow(() => Date.parse('2026-11-25T19:00:00Z'));
    answer = body({ isDay: 0, time: '2026-11-25T20:00' });
    const steps = Array.from({ length: 8 }, (_, i) => ({
      at: Date.parse('2026-11-25T15:00:00Z') + i * 3 * 3600000,
      kp: 8,
    }));
    localStorage.setItem(KP_KEY, JSON.stringify({ at: Date.parse('2026-11-25T18:00:00Z'), steps }));
    renderPage();
    const keys = await screen.findByTestId('weather-keys', undefined, SLOW);
    expect(keys).toHaveTextContent('Polarlicht möglich');
    const next = await screen.findByTestId('weather-sky-next', undefined, SLOW);
    expect(next).toHaveTextContent('Heute Nacht: Polarlicht möglich');
    expect(next).toHaveTextContent(
      /Blick nach Norden, abseits von Licht\. Am ehesten zwischen \d+ und \d+ Uhr\./,
    );
    expect(next).toHaveTextContent('Quelle: NOAA SWPC, Vorhersage Kp 8');
  });
});
