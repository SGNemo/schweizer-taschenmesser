import { describe, expect, it } from 'vitest';
import {
  daysToNotice,
  minusNotice,
  noticeFromInput,
  noticeMonthsOf,
  noticeToDays,
  plusNotice,
} from './notice';

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

describe('calendar months', () => {
  it('counts months only while they still match the days', () => {
    expect(noticeMonthsOf({ days: 90, months: 3 })).toBe(3);
    expect(noticeMonthsOf({ days: 60, months: 3 })).toBeUndefined(); // days changed alone
    expect(noticeMonthsOf({ days: 90 })).toBeUndefined();
  });

  it('moves by calendar months, not by 30 days', () => {
    // 3 months before 31 Dec is 30 Sep; 90 days before is 2 Oct.
    expect(minusNotice('2026-12-31', { days: 90, months: 3 })).toBe('2026-09-30');
    expect(minusNotice('2026-12-31', { days: 90 })).toBe('2026-10-02');
    // End of month clamps.
    expect(minusNotice('2026-03-31', { days: 30, months: 1 })).toBe('2026-02-28');
    expect(plusNotice('2026-01-31', { days: 30, months: 1 })).toBe('2026-02-28');
    // Across a year boundary.
    expect(minusNotice('2027-01-15', { days: 90, months: 3 })).toBe('2026-10-15');
  });

  it('keeps the month count only for whole months within the limit', () => {
    expect(noticeFromInput('3', 'months', 365)).toEqual({ days: 90, months: 3 });
    expect(noticeFromInput('1,5', 'months', 365)).toEqual({ days: 45 });
    expect(noticeFromInput('13', 'months', 365)).toEqual({ days: 365 });
    expect(noticeFromInput('2', 'weeks', 365)).toEqual({ days: 14 });
    expect(noticeFromInput('', 'months', 365)).toBeUndefined();
  });
});
