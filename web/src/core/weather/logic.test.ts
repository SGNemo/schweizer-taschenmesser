import { describe, expect, it } from 'vitest';
import type { Forecast } from './api';
import { codeGroup, dayRows, hasPreview, hourRows, placeNowIso, rainFrom } from './logic';

describe('codeGroup', () => {
  it('groups WMO codes into nine calm words', () => {
    expect(codeGroup(0)).toBe('clear');
    expect(codeGroup(1)).toBe('partly');
    expect(codeGroup(2)).toBe('partly');
    expect(codeGroup(3)).toBe('cloudy');
    expect(codeGroup(45)).toBe('fog');
    expect(codeGroup(53)).toBe('drizzle');
    expect(codeGroup(63)).toBe('rain');
    expect(codeGroup(75)).toBe('snow');
    expect(codeGroup(86)).toBe('snow');
    expect(codeGroup(81)).toBe('showers');
    expect(codeGroup(95)).toBe('thunder');
    expect(codeGroup(99)).toBe('thunder');
  });

  it('falls back to "bedeckt" for a code it does not know', () => {
    expect(codeGroup(42)).toBe('cloudy');
  });
});

describe('rainFrom', () => {
  const times = Array.from({ length: 24 }, (_, h) => `2026-10-19T${String(h).padStart(2, '0')}:00`);
  const probs = (map: Record<number, number>) => times.map((_, h) => map[h] ?? 0);

  it('names the first coming hour with at least 60 % chance of rain', () => {
    expect(rainFrom(times, probs({ 15: 70, 17: 90 }), '2026-10-19T12:30', 'partly')).toBe('15');
  });

  it('ignores hours that are over, weak chances and anything beyond twelve hours', () => {
    expect(rainFrom(times, probs({ 9: 90 }), '2026-10-19T12:30', 'clear')).toBeUndefined();
    expect(rainFrom(times, probs({ 15: 59 }), '2026-10-19T12:30', 'clear')).toBeUndefined();
    expect(rainFrom(times, probs({ 23: 90 }), '2026-10-19T08:00', 'clear')).toBeUndefined();
  });

  it('says nothing when it already rains', () => {
    expect(rainFrom(times, probs({ 15: 90 }), '2026-10-19T12:30', 'rain')).toBeUndefined();
  });

  it('copes with missing values and the next day', () => {
    expect(rainFrom(['2026-10-20T01:00'], [95], '2026-10-19T23:00', 'cloudy')).toBeUndefined();
    expect(
      rainFrom(
        times,
        times.map(() => null),
        '2026-10-19T08:00',
        'cloudy',
      ),
    ).toBeUndefined();
  });
});

describe('preview rows', () => {
  const hours = Array.from({ length: 48 }, (_, i) => ({
    time: `2026-10-${19 + Math.floor(i / 24)}T${String(i % 24).padStart(2, '0')}:00`,
    temp: i,
    group: 'clear' as const,
    rain: 0,
  }));
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-10-${19 + i}`,
    min: 1,
    max: 2,
    group: 'clear' as const,
    rain: 0,
  }));
  const forecast: Forecast = { temp: 1, group: 'clear', hours, days };

  it('hourRows: the next 12 hours from the current one, across midnight', () => {
    const rows = hourRows(forecast, '2026-10-19T21:40');
    expect(rows).toHaveLength(12);
    expect(rows[0]!.time).toBe('2026-10-19T21:00');
    expect(rows[11]!.time).toBe('2026-10-20T08:00');
  });

  it('hourRows: fewer rows when less is left, none without data', () => {
    expect(hourRows(forecast, '2026-10-20T20:00')).toHaveLength(4);
    expect(hourRows({ temp: 1, group: 'clear' }, '2026-10-19T08:00')).toEqual([]);
  });

  it('dayRows: today and six more, past days dropped', () => {
    expect(dayRows(forecast, '2026-10-19').map((d) => d.date)).toEqual(
      Array.from({ length: 7 }, (_, i) => `2026-10-${19 + i}`),
    );
    expect(dayRows(forecast, '2026-10-21')[0]!.date).toBe('2026-10-21');
    expect(dayRows(forecast, '2026-10-21')).toHaveLength(5);
  });

  it('hasPreview needs both lists', () => {
    expect(hasPreview(forecast)).toBe(true);
    expect(hasPreview({ temp: 1, group: 'clear', hours })).toBe(false);
  });

  it('placeNowIso: the place clock moves on with the time passed since the fetch', () => {
    const f: Forecast = { temp: 1, group: 'clear', time: '2026-10-19T23:30' };
    expect(placeNowIso(f, 1000, 1000 + 45 * 60 * 1000)).toBe('2026-10-20T00:15');
    expect(placeNowIso(f, 5000, 1000)).toBe('2026-10-19T23:30');
  });

  it('placeNowIso: device clock for values without a time', () => {
    const at = new Date(2026, 9, 19, 8, 5).getTime();
    expect(placeNowIso({ temp: 1, group: 'clear' }, at, at)).toBe('2026-10-19T08:05');
  });
});
