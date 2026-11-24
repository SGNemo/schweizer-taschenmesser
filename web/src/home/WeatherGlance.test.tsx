// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { now, setNow } from '@/core/time/now';
import { cacheKey, writeCache } from '@/core/weather/cache';
import { chooseWeatherPlace, getWeatherSettings } from '@/core/weather/settings';
import WeatherGlance from './WeatherGlance';

beforeEach(async () => {
  await db.table('_settings').clear();
  localStorage.clear();
  setNow(() => new Date(2026, 10, 24, 2, 50).getTime());
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  setNow();
});

describe('overview weather line', () => {
  it('says the word of the WMO code (1 → "überwiegend klar"), like the head and the widget', async () => {
    await chooseWeatherPlace('Lindenau', 50.1, 10.2);
    const s = await getWeatherSettings();
    writeCache({
      key: cacheKey(s.lat, s.lon),
      at: now(),
      forecast: { temp: -4, group: 'partly', code: 1, time: '2026-11-24T02:50' },
    });
    render(
      <MemoryRouter>
        <WeatherGlance />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link')).toHaveTextContent('-4° · überwiegend klar');
  });

  it('a value cached without a code keeps its group word', async () => {
    await chooseWeatherPlace('Lindenau', 50.1, 10.2);
    const s = await getWeatherSettings();
    writeCache({ key: cacheKey(s.lat, s.lon), at: now(), forecast: { temp: 9, group: 'cloudy' } });
    render(
      <MemoryRouter>
        <WeatherGlance />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link')).toHaveTextContent('9° · bedeckt');
  });
});
