import { describe, expect, it } from 'vitest';
import { codeGroup, rainFrom } from './logic';

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
