// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchForecast, HOURS_KEPT } from './api';
import { CACHE_KEY, readCache, writeCache } from './cache';
import airFixture from './fixtures/air-bern-r2.json';
import forecastFixture from './fixtures/forecast-bern-r2.json';

/**
 * Round 2, package B: the answer with every added variable (fixtures in `fixtures/*-r2.json`, recorded with
 * `scripts/capture-weather-fixtures.mjs`), parsed into `HourRow`, `Forecast.soon` and `Air.hours`, and the cache.
 */
const answer = (url: string) =>
  new Response(JSON.stringify(url.includes('air-quality') ? airFixture : forecastFixture), {
    status: 200,
  });
const f = vi.fn(async (input: RequestInfo | URL) =>
  answer(String(input)),
) as unknown as typeof fetch;

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('round-2 values from the recorded answer', () => {
  it('keeps all 168 hours from today 00:00, today’s past hours included', async () => {
    const out = await fetchForecast(46.95, 7.45, f);
    // The answer holds 168 hours; one of them has no code and is left out (as before round 2).
    expect(HOURS_KEPT).toBe(168);
    expect(out.hours).toHaveLength(167);
    expect(out.hours![0]!.time).toBe('2026-11-26T00:00');
    expect(out.hours!.at(-1)!.time).toBe('2026-12-02T23:00');
  });

  it('parses the added hourly fields with their units and rounding', async () => {
    const out = await fetchForecast(46.95, 7.45, f);
    const h = out.hours!.find((r) => r.time === '2026-11-28T04:00')!;
    expect(h).toMatchObject({ snow: 0.5, snowDepth: 0.05, freeze: 700 });
    const night = out.hours![2]!;
    expect(night.vis).toBe(900);
    expect(night.sunMin).toBe(0);
    const noon = out.hours![12]!;
    expect(noon.sunMin).toBe(24); // 1440 s
    expect(typeof noon.cloudLow).toBe('number');
    expect(typeof noon.cloudMid).toBe('number');
    expect(typeof noon.cloudHigh).toBe('number');
    expect(typeof noon.dew).toBe('number');
    expect(out.hours![14]!.cape).toBe(120);
  });

  it('a null in an added series leaves only that field out', async () => {
    const out = await fetchForecast(46.95, 7.45, f);
    // Hour 160 has no code in the fixture: the whole row is left out, as before round 2.
    expect(out.hours!.some((r) => r.time === '2026-12-02T16:00')).toBe(false);
  });

  it('keeps the eight 15-minute amounts from the current quarter', async () => {
    const out = await fetchForecast(46.95, 7.45, f);
    expect(out.soon).toEqual({ at: '2026-11-26T14:00', mm: [0, 0, 0.2, 0.3, 0.3, 0.1, 0, 0] });
  });

  it('keeps the air index per hour, a null hour left out', async () => {
    const out = await fetchForecast(46.95, 7.45, f);
    expect(out.air?.hours).toHaveLength(119);
    expect(out.air?.hours?.[0]).toEqual({ t: '2026-11-26T00:00', aqi: 20 });
    expect(out.air?.hours?.some((a) => a.t === '2026-11-26T07:00')).toBe(false);
  });

  it('without the added variables every new part is simply absent', async () => {
    const bare = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            current: { time: '2026-11-26T14:00', temperature_2m: 3, weather_code: 3 },
            hourly: {
              time: ['2026-11-26T14:00', '2026-11-26T15:00'],
              temperature_2m: [3, 3],
              weather_code: [3, 3],
              precipitation_probability: [0, 0],
            },
            minutely_15: { time: ['2026-11-26T14:00'], precipitation: [0] },
          }),
          { status: 200 },
        ),
    ) as unknown as typeof fetch;
    const out = await fetchForecast(46.95, 7.45, bare);
    // Fewer than eight steps are kept as they come; a series that ends before now is nothing.
    expect(out.soon).toEqual({ at: '2026-11-26T14:00', mm: [0] });
    expect(out.hours![0]!.dew).toBeUndefined();
    expect(JSON.parse(JSON.stringify(out.hours![0]))).toEqual({
      time: '2026-11-26T14:00',
      temp: 3,
      group: 'cloudy',
      code: 3,
      rain: 0,
    });
  });
});

describe('cache with all hours', () => {
  it('round-trips all hours (seven days) and stays under 64 KB for the main place', async () => {
    const forecast = await fetchForecast(46.95, 7.45, f);
    writeCache({ key: '46.95,7.45', at: 1, forecast });
    const raw = localStorage.getItem(CACHE_KEY)!;
    expect(new TextEncoder().encode(raw).length).toBeLessThanOrEqual(64 * 1024);
    const back = readCache()!;
    expect(back.forecast.hours).toHaveLength(167);
    expect(back.forecast.soon).toEqual(forecast.soon);
    expect(back.forecast.air?.hours).toEqual(forecast.air?.hours);
    expect(back.forecast).toEqual(JSON.parse(JSON.stringify(forecast)));
  });

  it('an entry stored before round 2 stays valid as it is', () => {
    const old = {
      key: 'k',
      at: 1,
      forecast: {
        temp: 3,
        group: 'cloudy',
        hours: [{ time: '2026-11-26T14:00', temp: 3, group: 'cloudy', rain: 0, hpa: 1012 }],
        days: [{ date: '2026-11-26', min: 1, max: 4, group: 'cloudy', rain: 0 }],
        air: { now: {}, pollen: {}, days: [] },
      },
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(old));
    expect(readCache()).toEqual(old);
  });

  it('drops a value with a damaged 15-minute part', () => {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        key: 'k',
        at: 1,
        forecast: { temp: 3, group: 'cloudy', soon: { at: 'x', mm: ['a'] } },
      }),
    );
    expect(readCache()).toBeUndefined();
  });
});

describe('the new hour fields reach the picture (package A lands first, B wires through)', () => {
  it('sceneHourOf carries the three cloud heights, sunshine, visibility and cape of the hour of now', async () => {
    const { sceneHourOf, coverOf, sunLevel } = await import('./scene');
    const forecast = await fetchForecast(46.95, 7.45, f);
    const h = sceneHourOf(forecast, '2026-11-26T12:20');
    const row = forecast.hours!.find((r) => r.time === '2026-11-26T12:00')!;
    expect(h).toMatchObject({
      cloudLow: row.cloudLow,
      cloudMid: row.cloudMid,
      cloudHigh: row.cloudHigh,
      sunMin: row.sunMin,
      vis: row.vis,
      cape: row.cape,
    });
    // With the heights known, the cover follows low and middle cloud, not the total.
    expect(coverOf(h)).toBe(coverOf({ cloud: Math.max(row.cloudLow!, row.cloudMid!) }));
    expect(sunLevel(h, coverOf(h))).toBeGreaterThanOrEqual(0);
  });
});
