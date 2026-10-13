import { describe, expect, it } from 'vitest';
import { parseTimerQuery } from './expression';

describe('timer expression', () => {
  it('reads minutes, hours and seconds, with a decimal comma', () => {
    expect(parseTimerQuery('timer 10')).toBe(10);
    expect(parseTimerQuery('Timer 10m')).toBe(10);
    expect(parseTimerQuery('timer 10 min')).toBe(10);
    expect(parseTimerQuery('timer 1,5 h')).toBe(90);
    expect(parseTimerQuery('timer 2 std')).toBe(120);
    expect(parseTimerQuery('timer 90 s')).toBe(1.5);
    expect(parseTimerQuery('stoppuhr 3 minuten')).toBe(3);
  });

  it('ignores everything else, and anything below one minute or above a day', () => {
    for (const q of [
      'timer',
      'timer abc',
      'timer 30 s',
      'timer 25 h',
      'timer 0',
      'eine timer 5',
      'tim 5',
    ])
      expect(parseTimerQuery(q), q).toBeUndefined();
  });
});
