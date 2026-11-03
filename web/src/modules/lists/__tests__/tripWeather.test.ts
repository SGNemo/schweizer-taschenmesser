import { describe, expect, it } from 'vitest';
import { inForecastRange, packingHint } from '../components/TripWeather';

describe('trip weather hint', () => {
  it('asks only for trips within the forecast week', () => {
    expect(inForecastRange('2026-11-03', '2026-11-03')).toBe(true);
    expect(inForecastRange('2026-11-09', '2026-11-03')).toBe(true);
    expect(inForecastRange('2026-11-10', '2026-11-03')).toBe(false);
    expect(inForecastRange('2026-11-02', '2026-11-03')).toBe(false);
  });

  it('hints at rain, heat or cold and says nothing on an ordinary day', () => {
    expect(packingHint({ min: 8, max: 14, rain: 80, group: 'rain' })).toBeTruthy();
    expect(packingHint({ min: 18, max: 30, rain: 0, group: 'clear' })).toBeTruthy();
    expect(packingHint({ min: 1, max: 9, rain: 10, group: 'cloudy' })).toBeTruthy();
    expect(packingHint({ min: 10, max: 18, rain: 10, group: 'partly' })).toBeUndefined();
  });
});
