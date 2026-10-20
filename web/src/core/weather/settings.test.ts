import { describe, expect, it } from 'vitest';
import { DEFAULT_WEATHER, isWeatherActive, roundCoord } from './settings';

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
