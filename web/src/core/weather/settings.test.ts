import { describe, expect, it } from 'vitest';
import { DEFAULT_WEATHER, isWeatherActive, roundCoord } from './settings';
import { freshCache, WEATHER_TTL_MS } from './useWeather';

describe('weather settings', () => {
  it('is on by default but inactive without a place', () => {
    expect(DEFAULT_WEATHER.enabled).toBe(true);
    expect(isWeatherActive(DEFAULT_WEATHER)).toBe(false);
    expect(isWeatherActive({ ...DEFAULT_WEATHER, place: 'Bern' })).toBe(true);
    expect(isWeatherActive({ enabled: false, place: 'Bern', lat: 46.95, lon: 7.45 })).toBe(false);
  });

  it('rounds a position to about a kilometre', () => {
    expect(roundCoord(52.520008)).toBe(52.52);
    expect(roundCoord(13.404954)).toBe(13.4);
    expect(roundCoord(-0.0049)).toBe(-0);
  });
});

describe('forecast cache', () => {
  const forecast = { temp: 14, group: 'clear' as const };
  const cached = { key: '46.95,7.45', at: 1_000_000, forecast };

  it('is fresh for 30 minutes and only for the same place', () => {
    expect(freshCache('46.95,7.45', 1_000_000 + WEATHER_TTL_MS - 1, cached)).toBe(forecast);
    expect(freshCache('46.95,7.45', 1_000_000 + WEATHER_TTL_MS, cached)).toBeUndefined();
    expect(freshCache('51.1,9', 1_000_001, cached)).toBeUndefined();
    expect(freshCache('46.95,7.45', 1_000_001, undefined)).toBeUndefined();
  });
});
