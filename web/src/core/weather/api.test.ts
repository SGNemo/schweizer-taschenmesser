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
      time: '2026-10-19T12:00',
    });
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain('latitude=52.52');
    expect(url).toContain('longitude=13.41');
  });

  it('asks for hours and days in one request and keeps them rounded from the current hour on', async () => {
    const days = ['2026-10-19', '2026-10-20'];
    const f = ok({
      current: { time: '2026-10-19T12:20', temperature_2m: 13.6, weather_code: 2 },
      hourly: {
        time: times,
        temperature_2m: times.map((_, h) => h + 0.4),
        weather_code: times.map((_, h) => (h === 14 ? 95 : 3)),
        precipitation_probability: times.map((_, h) => (h === 14 ? 41.6 : null)),
      },
      daily: {
        time: days,
        weather_code: [61, 0],
        temperature_2m_max: [15.5, 18.2],
        temperature_2m_min: [7.4, null],
        precipitation_probability_max: [80, 0],
      },
    });
    const out = await fetchForecast(52.52, 13.41, f);
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain('forecast_days=7');
    expect(url).toContain('hourly=temperature_2m%2Cweather_code%2Cprecipitation_probability');
    expect(url).toContain('daily=weather_code%2Ctemperature_2m_max');
    expect(out.hours?.[0]).toEqual({
      time: '2026-10-19T12:00',
      temp: 12,
      group: 'cloudy',
      rain: 0,
    });
    expect(out.hours?.[2]).toEqual({
      time: '2026-10-19T14:00',
      temp: 14,
      group: 'thunder',
      rain: 42,
    });
    expect(out.hours).toHaveLength(12); // the answer holds 24 hours; from the current hour on 12 remain
    // A day with a missing value is left out rather than invented.
    expect(out.days).toEqual([{ date: '2026-10-19', min: 7, max: 16, group: 'rain', rain: 80 }]);
  });

  it('keeps the detail values rounded and leaves out what is missing', async () => {
    const f = ok({
      current: {
        time: '2026-10-19T12:20',
        temperature_2m: 13.6,
        weather_code: 2,
        apparent_temperature: 11.5,
        relative_humidity_2m: 71.2,
        wind_speed_10m: 14.4,
        wind_gusts_10m: 33.9,
        is_day: 1,
      },
      hourly: {
        time: ['2026-10-19T12:00', '2026-10-19T22:00'],
        temperature_2m: [13.6, 8],
        weather_code: [2, 0],
        precipitation_probability: [10, 0],
        apparent_temperature: [11.5, null],
        precipitation: [0.04, 1.26],
        wind_speed_10m: [14.4, 6],
        wind_gusts_10m: [33.9, null],
        relative_humidity_2m: [71.2, 80],
        uv_index: [2.34, 0],
        is_day: [1, 0],
      },
      daily: {
        time: ['2026-10-19'],
        weather_code: [2],
        temperature_2m_max: [15],
        temperature_2m_min: [7],
        precipitation_probability_max: [30],
        apparent_temperature_max: [13.4],
        apparent_temperature_min: [5.5],
        precipitation_sum: [2.44],
        wind_speed_10m_max: [22.2],
        wind_gusts_10m_max: [48],
        uv_index_max: [3.06],
        sunrise: ['2026-10-19T07:32'],
        sunset: ['2026-10-19T18:21'],
        sunshine_duration: [19800],
      },
    });
    const out = await fetchForecast(46.95, 7.45, f);
    expect(out.now).toEqual({ feels: 12, hum: 71, wind: 14, gust: 34, night: false });
    expect(out.hours![0]).toMatchObject({
      feels: 12,
      mm: 0,
      wind: 14,
      gust: 34,
      hum: 71,
      uv: 2.3,
      night: false,
    });
    expect(out.hours![1]).toMatchObject({ feels: undefined, mm: 1.3, night: true });
    expect(out.days![0]).toEqual({
      date: '2026-10-19',
      min: 7,
      max: 15,
      group: 'partly',
      rain: 30,
      feelsMin: 6,
      feelsMax: 13,
      mm: 2.4,
      wind: 22,
      gust: 48,
      uv: 3.1,
      sunrise: '07:32',
      sunset: '18:21',
      sunMin: 330,
    });
    const url = String((f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]![0]);
    expect(url).toContain('apparent_temperature');
    expect(url).toContain('sunshine_duration');
    expect(url).toContain('latitude=46.95');
    expect(url).not.toMatch(/name=|query=/);
  });

  it('leaves hours and days out when the answer has none', async () => {
    const out = await fetchForecast(
      1,
      2,
      ok({ current: { time: '2026-10-19T12:00', temperature_2m: 1, weather_code: 0 } }),
    );
    expect(out.hours).toBeUndefined();
    expect(out.days).toBeUndefined();
    expect(out.now).toBeUndefined();
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
      time: '2026-10-19T12:00',
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
