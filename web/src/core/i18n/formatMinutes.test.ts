import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from './catalogs';
import { setLang } from './lang';
import { formatMinutes } from './format';

afterEach(() => setLang('de'));

describe('formatMinutes', () => {
  it('long form: hours and minutes as words (time tracking keeps this form)', () => {
    expect(formatMinutes(185)).toBe('3 Std 5 Min');
    expect(formatMinutes(45)).toBe('45 Min');
    expect(formatMinutes(0)).toBe('0 Min');
    expect(formatMinutes(120)).toBe('2 Std 0 Min');
  });

  it('compact form: "1 h 30", whole hours without minutes, minutes alone with the unit', () => {
    expect(formatMinutes(90, { compact: true })).toBe('1 h 30');
    expect(formatMinutes(240, { compact: true })).toBe('4 h');
    expect(formatMinutes(47, { compact: true })).toBe('47 Min');
    expect(formatMinutes(192, { compact: true })).toBe('3 h 12');
  });

  it('clamps negative and fractional input to whole minutes', () => {
    expect(formatMinutes(-5, { compact: true })).toBe('0 Min');
    expect(formatMinutes(29.6)).toBe('30 Min');
    expect(formatMinutes(Number.NaN)).toBe('0 Min');
  });

  it('follows the UI language', async () => {
    await loadCatalog('en');
    setLang('en');
    expect(formatMinutes(185)).toBe('3 h 5 min');
    expect(formatMinutes(45, { compact: true })).toBe('45 min');
    expect(formatMinutes(90, { compact: true })).toBe('1 h 30');
  });
});
