// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { WEATHER_RETRY_MS, WEATHER_TTL_MS } from '@/core/weather/cache';
import { chooseWeatherPlace, setWeatherEnabled } from '@/core/weather/settings';
import { WeatherLine } from './WeatherLine';

const times = Array.from({ length: 24 }, (_, h) => `2026-10-19T${String(h).padStart(2, '0')}:00`);
const forecastBody = {
  current: { time: '2026-10-19T12:00', temperature_2m: 14.2, weather_code: 2 },
  hourly: { time: times, precipitation_probability: times.map((_, h) => (h === 15 ? 80 : 0)) },
};
const dayDates = Array.from({ length: 7 }, (_, i) => `2026-10-${19 + i}`);
const previewBody = {
  current: forecastBody.current,
  hourly: {
    time: [...times, ...times.map((t) => t.replace('-19T', '-20T'))],
    temperature_2m: Array.from({ length: 48 }, (_, i) => 10 + (i % 5)),
    weather_code: Array.from({ length: 48 }, () => 3),
    precipitation_probability: Array.from({ length: 48 }, (_, i) =>
      i === 15 ? 80 : i === 16 ? 10 : 0,
    ),
  },
  daily: {
    time: dayDates,
    weather_code: dayDates.map(() => 61),
    temperature_2m_max: dayDates.map(() => 15),
    temperature_2m_min: dayDates.map(() => 7),
    precipitation_probability_max: dayDates.map((_, i) => (i === 0 ? 40 : 10)),
  },
};

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  setNow();
});

const renderLine = () =>
  render(
    <MemoryRouter>
      <WeatherLine />
    </MemoryRouter>,
  );

describe('WeatherLine', () => {
  it('shows nothing and asks nothing without a chosen place', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    renderLine();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('weather-line')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('shows place, temperature, words and the rain hint for a chosen place', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(forecastBody), { status: 200 })),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderLine();
    await waitFor(() =>
      expect(screen.getByTestId('weather-line')).toHaveTextContent(
        'Bern · 14° leicht bewölkt · ab 15 Uhr Regen',
      ),
    );
  });

  it('stays away when the switch is off or the weather cannot be reached', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    });
    vi.stubGlobal('fetch', f);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderLine();
    await waitFor(() => expect(f).toHaveBeenCalled());
    expect(screen.queryByTestId('weather-line')).toBeNull();

    cleanup();
    f.mockClear();
    await setWeatherEnabled(false);
    renderLine();
    await new Promise((r) => setTimeout(r, 50));
    expect(f).not.toHaveBeenCalled();
    expect(screen.queryByTestId('weather-line')).toBeNull();
  });

  it('does not ask again for a few minutes after a failed request', async () => {
    const T0 = Date.UTC(2026, 9, 19, 10, 0, 0);
    setNow(() => T0);
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    });
    vi.stubGlobal('fetch', f);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderLine();
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem('tm-weather-tried')).toContain('"at"'));
    cleanup();
    renderLine(); // a reload a minute later: no new request
    await new Promise((r) => setTimeout(r, 50));
    expect(f).toHaveBeenCalledTimes(1);
    cleanup();
    setNow(() => T0 + WEATHER_RETRY_MS);
    renderLine(); // after the retry window it asks once more
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
  });

  it('names the line (now a button) by its text, not by a label that hides it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(forecastBody), { status: 200 })),
    );
    await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
    renderLine();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Bern · 14° leicht bewölkt/ })).toBeTruthy(),
    );
  });

  it('offers one quiet hint without a place; "Später nicht mehr" ends it for good', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    renderLine();
    const hint = await screen.findByTestId('weather-hint');
    expect(hint).toHaveTextContent('Wetter: Stadt wählen');
    fireEvent.click(screen.getByRole('button', { name: 'Später nicht mehr' }));
    expect(screen.queryByTestId('weather-hint')).toBeNull();
    expect(localStorage.getItem('tm-weather-hint')).toBe('off');
    cleanup();
    renderLine();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('weather-hint')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('shows no hint when the switch is off', async () => {
    await setWeatherEnabled(false);
    renderLine();
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('weather-hint')).toBeNull();
  });

  it('offline: asks nothing and shows the old values with "Stand hh:mm"', async () => {
    const t0 = new Date(2026, 9, 19, 10, 5).getTime();
    setNow(() => t0);
    localStorage.setItem(
      'tm-weather',
      JSON.stringify({
        key: '46.95,7.45',
        at: t0 - 2 * WEATHER_TTL_MS,
        forecast: { temp: 9, group: 'rain', rainFrom: '15' },
      }),
    );
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
    renderLine();
    await waitFor(() =>
      expect(screen.getByTestId('weather-line')).toHaveTextContent(
        /^Bern · 9° Regen · Stand 0?9:05$/,
      ),
    );
    expect(f).not.toHaveBeenCalled();
  });

  describe('preview', () => {
    const open = async () => {
      renderLine();
      fireEvent.click(await screen.findByTestId('weather-line'));
      return screen.findByTestId('weather-preview');
    };

    it('a tap opens 12 hours and 7 days; rain only from 30 %, never a colour or a warning', async () => {
      setNow(() => new Date(2026, 9, 19, 12, 5).getTime());
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(previewBody), { status: 200 })),
      );
      await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
      const preview = await open();
      expect(screen.getByRole('heading', { name: 'Bern' })).toBeTruthy();
      const hours = screen.getByTestId('weather-hours').querySelectorAll('li');
      const days = screen.getByTestId('weather-days').querySelectorAll('li');
      expect(hours).toHaveLength(12);
      expect(days).toHaveLength(7);
      expect(hours[0]).toHaveTextContent(/12:00 · 12° · bedeckt$/);
      expect(hours[3]).toHaveTextContent(/15:00 · 10° · bedeckt · Regen 80 %$/);
      expect(hours[4]).not.toHaveTextContent('Regen');
      expect(days[0]).toHaveTextContent(/7° \/ 15° · Regen · Regen 40 %$/);
      expect(days[1]).not.toHaveTextContent('Regen 10');
      expect(preview).not.toHaveTextContent('Stand');
    });

    it('links to the weather settings and credits Open-Meteo', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => new Response(JSON.stringify(previewBody), { status: 200 })),
      );
      await chooseWeatherPlace('Bern, Schweiz', 46.9481, 7.4474);
      await open();
      expect(screen.getByRole('link', { name: 'Einstellungen' }).getAttribute('href')).toBe(
        '/settings/verbindungen#weather',
      );
      expect(screen.getByTestId('weather-preview-credit')).toHaveTextContent('Open-Meteo.com');
    });

    it('offline: the last preview stays with "Stand hh:mm" and nothing is asked', async () => {
      const t0 = new Date(2026, 9, 19, 12, 5).getTime();
      setNow(() => t0);
      const f = vi.fn();
      vi.stubGlobal('fetch', f);
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      localStorage.setItem(
        'tm-weather',
        JSON.stringify({
          key: '46.95,7.45',
          at: t0 - 2 * WEATHER_TTL_MS,
          forecast: {
            temp: 9,
            group: 'rain',
            time: '2026-10-19T11:05',
            hours: [{ time: '2026-10-19T12:00', temp: 9, group: 'rain', rain: 90 }],
            days: [{ date: '2026-10-19', min: 4, max: 11, group: 'rain', rain: 90 }],
          },
        }),
      );
      await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
      const preview = await open();
      expect(preview).toHaveTextContent(/Stand 0?11:05/);
      expect(screen.getByTestId('weather-hours').querySelectorAll('li')).toHaveLength(1);
      expect(f).not.toHaveBeenCalled();
    });

    it('an old cached value without preview data: "Wird geladen", one request, then the rows', async () => {
      const t0 = new Date(2026, 9, 19, 12, 5).getTime();
      setNow(() => t0);
      localStorage.setItem(
        'tm-weather',
        JSON.stringify({ key: '46.95,7.45', at: t0, forecast: { temp: 9, group: 'rain' } }),
      );
      const f = vi.fn(async () => new Response(JSON.stringify(previewBody), { status: 200 }));
      vi.stubGlobal('fetch', f);
      await chooseWeatherPlace('Bern, Schweiz', 46.95, 7.45);
      renderLine();
      await screen.findByTestId('weather-line');
      expect(f).not.toHaveBeenCalled(); // the line alone keeps the old value
      fireEvent.click(screen.getByTestId('weather-line'));
      expect(await screen.findByText('Wird geladen …')).toBeTruthy();
      await waitFor(() => expect(screen.getByTestId('weather-hours')).toBeTruthy());
      expect(f).toHaveBeenCalledTimes(1);
    });
  });
});
