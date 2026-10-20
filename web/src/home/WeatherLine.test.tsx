// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { WEATHER_TTL_MS } from '@/core/weather/cache';
import { chooseWeatherPlace, setWeatherEnabled } from '@/core/weather/settings';
import { WeatherLine } from './WeatherLine';

const times = Array.from({ length: 24 }, (_, h) => `2026-10-19T${String(h).padStart(2, '0')}:00`);
const forecastBody = {
  current: { time: '2026-10-19T12:00', temperature_2m: 14.2, weather_code: 2 },
  hourly: { time: times, precipitation_probability: times.map((_, h) => (h === 15 ? 80 : 0)) },
};

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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
});
