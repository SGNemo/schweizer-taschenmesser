// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { chooseWeatherPlace } from '@/core/weather/settings';
import { AreaFrame } from '@/layout/AreaFrame';
import WeatherPage from '../routes/WeatherPage';
import WeatherWidget from '../widgets/WeatherWidget';

/**
 * The night of docs/design/weather-scenes/ANALYSIS.md (invented place "Lindenau"): 2026-11-24 02:50, −4° (felt −9°),
 * WMO code 1, cloud cover 0 %, wind 9 km/h NE, day −6° / 2°, UV 1.5, sun 07:38–16:24.
 */
const dates = ['2026-11-24', '2026-11-25', '2026-11-26'];
const hourTimes = dates
  .slice(0, 2)
  .flatMap((d) => Array.from({ length: 24 }, (_, h) => `${d}T${String(h).padStart(2, '0')}:00`));
const night = (over: Record<string, unknown> = {}) => ({
  timezone: 'Europe/Berlin',
  current: {
    time: '2026-11-24T02:50',
    temperature_2m: -4.2,
    weather_code: 1,
    apparent_temperature: -9,
    relative_humidity_2m: 86,
    wind_speed_10m: 9,
    wind_gusts_10m: 18,
    is_day: 0,
    cloud_cover: 0,
    pressure_msl: 1027,
    wind_direction_10m: 45,
    snow_depth: 0,
    ...over,
  },
  hourly: {
    time: hourTimes,
    temperature_2m: hourTimes.map(() => -4),
    weather_code: hourTimes.map(() => 1),
    precipitation_probability: hourTimes.map(() => 0),
    is_day: hourTimes.map((t) => (t.slice(11, 13) >= '08' && t.slice(11, 13) < '16' ? 1 : 0)),
  },
  daily: {
    time: dates,
    weather_code: [1, 1, 1],
    temperature_2m_max: [2, 3, 3],
    temperature_2m_min: [-6, -5, -4],
    precipitation_probability_max: [0, 0, 0],
    uv_index_max: [1.5, 1.5, 1.5],
    sunrise: dates.map((d) => `${d}T07:38`),
    sunset: dates.map((d) => `${d}T16:24`),
  },
});

const ok = (body: unknown) =>
  vi.fn(async (url: string | URL | Request) =>
    String(url).includes('/v1/forecast')
      ? new Response(JSON.stringify(body), { status: 200 })
      : new Response('{}', { status: 500 }),
  );

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/weather']}>
      <AreaFrame>
        <WeatherPage />
      </AreaFrame>
    </MemoryRouter>,
  );

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
  setNow(() => new Date(2026, 10, 24, 2, 50).getTime());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setNow();
});

describe('weather words by WMO code (package 1a)', () => {
  it('code 1 is "überwiegend klar" in the head, the hour card, the day row and the widget', async () => {
    vi.stubGlobal('fetch', ok(night()));
    await chooseWeatherPlace('Lindenau', 50.1, 10.2);
    renderPage();
    const head = await screen.findByTestId('weather-now');
    await waitFor(() => expect(head).toHaveTextContent('überwiegend klar'));
    expect(head).not.toHaveTextContent('leicht bewölkt');
    const hour = (await screen.findByTestId('weather-hours')).querySelector('li')!;
    expect(hour).toHaveTextContent('überwiegend klar');
    const day = screen.getByTestId('weather-days').querySelector('li')!;
    expect(day).toHaveTextContent('überwiegend klar');
    cleanup();
    render(
      <MemoryRouter>
        <WeatherWidget />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('weather-widget')).toHaveTextContent('überwiegend klar');
  });

  it('at night: no UV, the next sunrise instead, the dry chip with an umbrella', async () => {
    vi.stubGlobal('fetch', ok(night()));
    await chooseWeatherPlace('Lindenau', 50.1, 10.2);
    renderPage();
    const keys = await screen.findByTestId('weather-keys');
    await waitFor(() => expect(keys).toHaveTextContent('Sonnenaufgang 07:38'));
    expect(keys).not.toHaveTextContent('UV');
    expect(keys).toHaveTextContent('Kein Regen in Sicht');
    const dry = within(keys).getByText('Kein Regen in Sicht').closest('li')!;
    expect(dry.querySelector('svg.lucide-umbrella')).not.toBeNull();
    expect(keys.querySelector('svg.lucide-sun')).toBeNull();
    // Frost stands after the word (−4°, no snow word, no snow lying).
    expect(screen.getByTestId('weather-now')).toHaveTextContent('überwiegend klar · Frost');
  });

  it('by day the UV chip is back; after sunset the sunrise is tomorrow’s', async () => {
    vi.stubGlobal('fetch', ok(night({ time: '2026-11-24T12:00', is_day: 1 })));
    setNow(() => new Date(2026, 10, 24, 12, 0).getTime());
    await chooseWeatherPlace('Lindenau', 50.1, 10.2);
    renderPage();
    const keys = await screen.findByTestId('weather-keys');
    await waitFor(() => expect(keys).toHaveTextContent('UV 1,5'));
    expect(keys).not.toHaveTextContent('Sonnenaufgang');
  });

  it('one extra word at most, by priority: gale-force gusts before snow on the ground', async () => {
    vi.stubGlobal(
      'fetch',
      ok(night({ weather_code: 3, wind_gusts_10m: 75, snow_depth: 0.12, temperature_2m: -2 })),
    );
    await chooseWeatherPlace('Lindenau', 50.1, 10.2);
    renderPage();
    const head = await screen.findByTestId('weather-now');
    await waitFor(() => expect(head).toHaveTextContent('bedeckt · Sturmböen'));
    // The detail line (the figure), not the hint pill under it (which may name a frost day).
    const detail = head.firstElementChild!;
    expect(detail).not.toHaveTextContent('Schnee liegt');
    expect(detail).not.toHaveTextContent('Frost');
  });
});
