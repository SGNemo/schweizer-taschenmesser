import { describe, expect, it } from 'vitest';
import type { HourRow } from './api';
import {
  dayLength,
  dewWord,
  hoursOfDay,
  pressureTendency,
  snowLine,
  thunderTendency,
} from './derived';

const hour = (time: string, hpa?: number): HourRow => ({
  time,
  temp: 5,
  group: 'cloudy',
  rain: 0,
  hpa,
});

describe('computed values (CONCEPT-INFO §4)', () => {
  it.each([
    ['07:41', '16:22', 521],
    ['05:28', '21:22', 954],
    [undefined, '16:22', undefined],
    ['16:22', '07:41', undefined],
  ])('day length %s–%s → %s min', (a, b, out) => expect(dayLength(a, b)).toBe(out));

  it.each([
    [1012, 1013, 'rising'],
    [1013, 1012, 'falling'],
    [1012, 1012.9, 'steady'],
    [1012, 1011.1, 'steady'],
  ] as const)('pressure %s → %s three hours later: %s', (before, now, word) => {
    const hours = [
      hour('2026-11-26T11:00', before),
      hour('2026-11-26T12:00', 1000),
      hour('2026-11-26T13:00', 1000),
      hour('2026-11-26T14:00', now),
    ];
    expect(pressureTendency(hours, '2026-11-26T14:20')).toBe(word);
  });

  it('has no tendency without the hour three hours earlier or with a gap in the rows', () => {
    expect(pressureTendency([hour('2026-11-26T14:00', 1012)], '2026-11-26T14:00')).toBeUndefined();
    const gap = [
      hour('2026-11-26T09:00', 1000),
      hour('2026-11-26T12:00', 1000),
      hour('2026-11-26T13:00', 1000),
      hour('2026-11-26T14:00', 1012),
    ];
    expect(pressureTendency(gap, '2026-11-26T14:00')).toBeUndefined();
    const missing = [hour('2026-11-26T11:00'), ...gap.slice(1)];
    expect(pressureTendency(missing, '2026-11-26T14:00')).toBeUndefined();
  });

  it.each([
    [700, 400],
    [1420, 1100],
    [1360, 1100],
    [200, 0],
    [undefined, undefined],
  ])('snowfall line of a 0 °C level at %s m: %s m', (f, out) => expect(snowLine(f)).toBe(out));

  it.each([
    [15.9, undefined],
    [16, 'muggy'],
    [19.9, 'muggy'],
    [20, 'oppressive'],
    [undefined, undefined],
  ])('dew point %s° → %s', (d, w) => expect(dewWord(d)).toBe(w));

  it.each([
    [799, undefined],
    [800, 'moderate'],
    [1999, 'moderate'],
    [2000, 'high'],
    [undefined, undefined],
  ])('cape %s → %s', (c, w) => expect(thunderTendency(c)).toBe(w));

  it('picks the hours of one day', () => {
    const hs = [hour('2026-11-26T23:00'), hour('2026-11-27T00:00'), hour('2026-11-27T01:00')];
    expect(hoursOfDay(hs, '2026-11-27').map((h) => h.time)).toEqual([
      '2026-11-27T00:00',
      '2026-11-27T01:00',
    ]);
  });
});
