import { describe, expect, it } from 'vitest';
import { daysToNotice, noticeToDays } from './notice';

describe('notice period units', () => {
  it('converts weeks and months to days (a month is 30 days)', () => {
    expect(noticeToDays('3', 'months', 365)).toBe(90);
    expect(noticeToDays('2', 'weeks', 365)).toBe(14);
    expect(noticeToDays('10', 'days', 365)).toBe(10);
  });

  it('is empty for blank or invalid input and clamps to the maximum', () => {
    expect(noticeToDays('', 'days', 365)).toBeUndefined();
    expect(noticeToDays('abc', 'weeks', 365)).toBeUndefined();
    expect(noticeToDays('24', 'months', 365)).toBe(365);
    expect(noticeToDays('0', 'months', 365)).toBe(0);
  });

  it('shows stored days in the largest exact unit', () => {
    expect(daysToNotice(90)).toEqual({ amount: 3, unit: 'months' });
    expect(daysToNotice(14)).toEqual({ amount: 2, unit: 'weeks' });
    expect(daysToNotice(10)).toEqual({ amount: 10, unit: 'days' });
    expect(daysToNotice(0)).toEqual({ amount: 0, unit: 'days' });
  });

  it('round-trips every stored value', () => {
    for (let d = 0; d <= 365; d++) {
      const { amount, unit } = daysToNotice(d);
      expect(noticeToDays(String(amount), unit, 365)).toBe(d);
    }
  });
});
