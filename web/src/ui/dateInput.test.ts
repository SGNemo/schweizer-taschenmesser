import { afterEach, describe, expect, it } from 'vitest';
import { setFormatPref } from '@/core/i18n/format';
import { setLang } from '@/core/i18n/lang';
import {
  datePlaceholder,
  formatDateInput,
  formatTimeInput,
  parseDateInput,
  parseTimeInput,
} from './dateInput';

afterEach(() => {
  setFormatPref('auto');
  setLang('de');
});

describe('date field text (app format, not the system locale)', () => {
  it('writes and reads the German form', () => {
    setFormatPref('de-DE');
    expect(formatDateInput('2026-09-03')).toBe('03.09.2026');
    expect(datePlaceholder({ day: 'T', month: 'M', year: 'J' })).toBe('TT.MM.JJJJ');
    expect(parseDateInput('03.09.2026')).toBe('2026-09-03');
    expect(parseDateInput('3.9.26')).toBe('2026-09-03');
    expect(parseDateInput('3.9.', '2027-01-01')).toBe('2027-09-03');
    expect(parseDateInput('03092026')).toBe('2026-09-03');
    expect(parseDateInput('030926')).toBe('2026-09-03');
  });

  it('follows the month-first order of the US region', () => {
    setLang('en');
    setFormatPref('en-US');
    expect(formatDateInput('2026-09-03')).toBe('09/03/2026');
    expect(parseDateInput('9/3/2026')).toBe('2026-09-03');
    expect(parseDateInput('09032026')).toBe('2026-09-03');
  });

  it('always reads the ISO form and refuses what is no date', () => {
    setFormatPref('de-DE');
    expect(parseDateInput('2026-09-03')).toBe('2026-09-03');
    expect(parseDateInput('31.02.2026')).toBeUndefined();
    expect(parseDateInput('2026-13-01')).toBeUndefined();
    expect(parseDateInput('morgen')).toBeUndefined();
    expect(parseDateInput('3')).toBeUndefined();
    expect(parseDateInput('3.9.202')).toBeUndefined();
    expect(parseDateInput('')).toBeUndefined();
  });
});

describe('time field text', () => {
  it('reads the short forms people type', () => {
    expect(parseTimeInput('9')).toBe('09:00');
    expect(parseTimeInput('930')).toBe('09:30');
    expect(parseTimeInput('1430')).toBe('14:30');
    expect(parseTimeInput('9.30')).toBe('09:30');
    expect(parseTimeInput('9:30 pm')).toBe('21:30');
    expect(parseTimeInput('12 am')).toBe('00:00');
    expect(parseTimeInput('14 Uhr')).toBe('14:00');
    expect(parseTimeInput('25:00')).toBeUndefined();
    expect(parseTimeInput('9:75')).toBeUndefined();
    expect(parseTimeInput('bald')).toBeUndefined();
  });

  it('writes the form of the region', () => {
    setFormatPref('de-DE');
    expect(formatTimeInput('14:30')).toBe('14:30');
    setLang('en');
    setFormatPref('en-US');
    expect(formatTimeInput('14:30')).toMatch(/^0?2:30\sPM$/);
  });
});
