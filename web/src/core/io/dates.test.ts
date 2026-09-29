import { describe, expect, it } from 'vitest';
import { parseDateInput, parseDayMonth } from './dates';

describe('parseDateInput', () => {
  it('reads ISO and German dates', () => {
    expect(parseDateInput('2026-03-15')).toBe('2026-03-15');
    expect(parseDateInput('15.03.2026')).toBe('2026-03-15');
    expect(parseDateInput('5.3.26')).toBe('2026-03-05');
    expect(parseDateInput(' 01. 11. 2026 ')).toBe('2026-11-01');
  });

  it('rejects impossible or unknown formats', () => {
    for (const bad of ['31.02.2026', '2026-13-01', '15.03.', 'morgen', '', '15/03/2026', '2026-02-29']) {
      expect(parseDateInput(bad), bad).toBeUndefined();
    }
    expect(parseDateInput('29.02.2028')).toBe('2028-02-29');
  });
});

describe('parseDayMonth', () => {
  it('reads day and month with an optional year', () => {
    expect(parseDayMonth('15.03.')).toEqual({ day: 15, month: 3 });
    expect(parseDayMonth('15.3')).toEqual({ day: 15, month: 3 });
    expect(parseDayMonth('15.03.1990')).toEqual({ day: 15, month: 3, year: 1990 });
    expect(parseDayMonth('01.12.85')).toEqual({ day: 1, month: 12, year: 1985 });
  });

  it('allows 29 February (birthdays) but not other impossible dates', () => {
    expect(parseDayMonth('29.02.')).toEqual({ day: 29, month: 2 });
    expect(parseDayMonth('31.04.')).toBeUndefined();
    expect(parseDayMonth('0.1.')).toBeUndefined();
    expect(parseDayMonth('15.13.')).toBeUndefined();
    expect(parseDayMonth('hallo')).toBeUndefined();
  });
});
