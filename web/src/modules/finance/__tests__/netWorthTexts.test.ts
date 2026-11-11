import { describe, expect, it } from 'vitest';
import { t } from '@/strings';
import { en } from '@/i18n/locales/en';

const AMOUNT = /\d[.,]\d\d|€|\$/;

describe('context line of the net worth', () => {
  const n = t.finance.netWorth;

  it('counts, the invoices first, and only the subscriptions are "until month end"', () => {
    // The line says that the figure above it does not deduct these.
    expect(n.open(2, 4)).toBe('Noch nicht abgezogen: 2 offene Rechnungen · 4 Abos bis Monatsende');
    expect(n.open(1, 1)).toBe('Noch nicht abgezogen: 1 offene Rechnung · 1 Abo bis Monatsende');
    expect(n.open(7, 0)).toBe('Noch nicht abgezogen: 7 offene Rechnungen');
    expect(n.open(0, 1)).toBe('Noch nicht abgezogen: 1 Abo bis Monatsende');
  });

  it('says "nothing" only about what was counted', () => {
    expect(n.nothingOpen(true, true)).toBe('Keine Rechnung offen, kein Abo mehr bis Monatsende.');
    // Invoices are switched off (module or setting): nothing is claimed about them.
    expect(n.nothingOpen(false, true)).toBe('Kein Abo mehr bis Monatsende.');
    expect(n.nothingOpen(true, false)).toBe('Keine Rechnung offen.');
    expect(en.finance.netWorth.nothingOpen(false, true)).not.toMatch(/invoice/);
    expect(en.finance.netWorth.nothingOpen(true, false)).not.toMatch(/subscription/);
  });

  it('carries no amount in either language', () => {
    for (const s of [n, en.finance.netWorth])
      for (const line of [s.open(3, 2), s.nothingOpen(true, true), s.named(3)])
        expect(line).not.toMatch(AMOUNT);
  });
});
