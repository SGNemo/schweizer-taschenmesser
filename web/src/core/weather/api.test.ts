import { describe, expect, it, vi } from 'vitest';
import { fetchForecast, searchPlaces, WeatherError } from './api';

const ok = (body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })) as unknown as typeof fetch;

describe('searchPlaces', () => {
  it('sends only the typed name and shapes the labels', async () => {
    const f = ok({
      results: [
        { name: 'Bern', admin1: 'Bern', country: 'Schweiz', latitude: 46.95, longitude: 7.45 },
        { name: 'Bern', admin1: 'Hessen', country: 'Deutschland', latitude: 51.1, longitude: 9 },
      ],
    });
    const out = await searchPlaces(' Bern ', f);
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain('geocoding-api.open-meteo.com');
    expect(url).toContain('name=Bern');
    expect(url).not.toContain('latitude');
    expect(out.map((p) => p.label)).toEqual(['Bern, Schweiz', 'Bern, Hessen, Deutschland']);
  });

  it('asks nothing for fewer than two letters and returns [] without results', async () => {
    const f = ok({});
    expect(await searchPlaces('B', f)).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    expect(await searchPlaces('Nirgendwo', f)).toEqual([]);
  });

  it('turns every failure into a WeatherError', async () => {
    const down = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(searchPlaces('Bern', down)).rejects.toBeInstanceOf(WeatherError);
    const bad = vi.fn(async () => new Response('x', { status: 500 })) as unknown as typeof fetch;
    await expect(searchPlaces('Bern', bad)).rejects.toBeInstanceOf(WeatherError);
  });
});

describe('fetchForecast', () => {
  const times = Array.from({ length: 24 }, (_, h) => `2026-10-19T${String(h).padStart(2, '0')}:00`);

  it('returns the rounded temperature, the word and the rain hint', async () => {
    const f = ok({
      current: { time: '2026-10-19T12:00', temperature_2m: 13.6, weather_code: 2 },
      hourly: {
        time: times,
        precipitation_probability: times.map((_, h) => (h === 15 ? 80 : 0)),
      },
    });
    expect(await fetchForecast(52.52, 13.41, f)).toEqual({
      temp: 14,
      group: 'partly',
      rainFrom: '15',
    });
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain('latitude=52.52');
    expect(url).toContain('longitude=13.41');
  });

  it('rejects an answer without current values', async () => {
    await expect(fetchForecast(1, 2, ok({}))).rejects.toBeInstanceOf(WeatherError);
  });
});
