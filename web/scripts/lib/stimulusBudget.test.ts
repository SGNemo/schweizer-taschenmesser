import { describe, expect, it } from 'vitest';
import { compare, formatReport, limitFor, makeBudget, type InventoryRow } from './stimulusBudget';

const row = (vp: string, page: string, o: Partial<Record<string, number>> = {}): InventoryRow => ({
  vp,
  page,
  scrollHeight: 1000,
  buttons: 10,
  links: 20,
  icons: 30,
  firstScreenActions: 15,
  ...o,
});
const base = makeBudget([row('phone', 'home'), row('desktop', 'home')]);

describe('limitFor', () => {
  it('height: larger of +10 % and +50 px', () => {
    expect(limitFor('height', 1000, base.tolerance)).toBe(1100);
    expect(limitFor('height', 200, base.tolerance)).toBe(250);
  });
  it('counts: +10 %, at least one more', () => {
    expect(limitFor('buttons', 100, base.tolerance)).toBe(110);
    expect(limitFor('buttons', 3, base.tolerance)).toBe(4);
    expect(limitFor('icons', 0, base.tolerance)).toBe(1);
  });
});

describe('compare', () => {
  it('same numbers: nothing to report', () => {
    const r = compare(base, [row('phone', 'home'), row('desktop', 'home')]);
    expect(r).toEqual({ violations: [], notes: [] });
    expect(formatReport(r)).toMatch(/within budget/);
  });
  it('at the limit passes, one over fails', () => {
    expect(
      compare(base, [
        row('phone', 'home', { scrollHeight: 1100, buttons: 11 }),
        row('desktop', 'home'),
      ]).violations,
    ).toEqual([]);
    const r = compare(base, [row('phone', 'home', { scrollHeight: 1101 }), row('desktop', 'home')]);
    expect(r.violations).toEqual([
      { key: 'phone--home', metric: 'height', budget: 1000, measured: 1101, limit: 1100 },
    ]);
  });
  it('improvements are never reported', () => {
    const r = compare(base, [
      row('phone', 'home', { buttons: 1, scrollHeight: 10 }),
      row('desktop', 'home'),
    ]);
    expect(r.violations).toEqual([]);
  });
  it('lists every exceeded value readably', () => {
    const r = compare(base, [
      row('phone', 'home', { links: 40, icons: 99 }),
      row('desktop', 'home'),
    ]);
    const text = formatReport(r);
    expect(text).toContain('phone--home · links · 20 → 40');
    expect(text).toContain('phone--home · icons · 30 → 99');
    expect(r.violations).toHaveLength(2);
  });
  it('missing page is a note, not a violation', () => {
    const r = compare(base, [row('phone', 'home')]);
    expect(r.violations).toEqual([]);
    expect(r.notes).toEqual([{ key: 'desktop--home', kind: 'missing' }]);
    expect(formatReport(r)).toContain('not measured');
  });
  it('new page is a note, not a violation', () => {
    const r = compare(base, [
      row('phone', 'home'),
      row('desktop', 'home'),
      row('phone', 'todos', { buttons: 999 }),
    ]);
    expect(r.violations).toEqual([]);
    expect(r.notes).toEqual([{ key: 'phone--todos', kind: 'new' }]);
  });
  it('a row without a number is an error, not a silent pass', () => {
    expect(() => compare(base, [row('phone', 'home', { links: undefined })])).toThrow(/links/);
  });
});

describe('makeBudget', () => {
  it('keeps only the five values, sorted by key', () => {
    const b = makeBudget([row('phone', 'home', { badgeLike: 5 }), row('desktop', 'calendar')]);
    expect(Object.keys(b.pages)).toEqual(['desktop--calendar', 'phone--home']);
    expect(Object.keys(b.pages['phone--home'])).toEqual([
      'height',
      'buttons',
      'links',
      'icons',
      'firstScreenActions',
    ]);
  });
});
