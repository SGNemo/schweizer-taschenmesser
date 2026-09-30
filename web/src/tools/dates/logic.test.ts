import { describe, expect, it } from 'vitest';
import { addDays, difference, isValidDate, weekInfo } from './logic';

describe('date calculator', () => {
  it('validates real dates only', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
  it('computes the difference', () => {
    expect(difference('2026-01-01', '2026-01-16')).toEqual({ days: 15, weeks: 2, rest: 1 });
    expect(difference('2026-01-16', '2026-01-01')).toEqual({ days: -15, weeks: 2, rest: 1 });
    expect(difference('2026-01-01', 'x')).toBeUndefined();
  });
  it('adds days across month ends and leap days', () => {
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-03-01', 1.5)).toBeUndefined();
  });
  it('gives weekday and ISO week', () => {
    expect(weekInfo('2026-09-29')).toEqual({ weekday: 2, week: 40 });
    expect(weekInfo('2027-01-01')).toEqual({ weekday: 5, week: 53 });
  });
});
