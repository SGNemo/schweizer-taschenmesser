import { describe, expect, it, vi } from 'vitest';
import { fetchForecast, searchPlaces, WeatherError } from './api';
import forecastFixture from './fixtures/forecast-bern.json';
import geocodingEmpty from './fixtures/geocoding-empty.json';
import geocodingFixture from './fixtures/geocoding-bern.json';

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

describe('recorded response shapes (fixtures follow the documented Open-Meteo JSON, extra fields included)', () => {
  it('parses a full forecast answer, nulls in the hourly series included', async () => {
    const f = ok(forecastFixture);
    expect(await fetchForecast(46.95, 7.45, f)).toEqual({
      temp: 14,
      group: 'partly',
      rainFrom: '17',
    });
  });

  it('parses a geocoding answer with and without region', async () => {
    const out = await searchPlaces('Bern', ok(geocodingFixture));
    expect(out.map((p) => p.label)).toEqual([
      'Bern, Schweiz',
      'Bern, Hessen, Deutschland',
      'Bernau, Deutschland',
    ]);
    expect(await searchPlaces('Nirgendwo', ok(geocodingEmpty))).toEqual([]);
  });

  it('rejects answers of the wrong shape instead of guessing', async () => {
    await expect(
      fetchForecast(1, 2, ok({ current: { time: 'x', temperature_2m: 'warm', weather_code: 1 } })),
    ).rejects.toBeInstanceOf(WeatherError);
    await expect(
      searchPlaces('Bern', ok({ results: [{ name: 'Bern', latitude: 'x', longitude: 1 }] })),
    ).rejects.toBeInstanceOf(WeatherError);
  });
});
