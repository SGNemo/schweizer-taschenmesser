import { describe, expect, it } from 'vitest';
import { buildForecast } from './forecast';
import { monthContext, monthGlance } from './month';
import { t } from '@/strings';

// Round 5, person B: one rough card "Diesen Monat" – still coming, spent, free (= the outlook).
describe('monthGlance', () => {
  it('takes what is coming and what stays free from the month outlook, spent from the bookings', () => {
    const forecast = buildForecast({
      balanceMinor: 100_000,
      today: '2026-11-08',
      to: '2026-11-30',
      repeatHeads: [],
      subscriptionCharges: [{ date: '2026-11-15', amountMinor: 1_299, name: 'Netflix' }],
      openInvoices: [
        { dueDate: '2026-11-20', amountMinor: 8_450, payee: 'Zahnarzt' },
        { dueDate: '2026-12-20', amountMinor: 7_000, payee: 'später' },
      ],
    });
    const g = monthGlance({
      forecast,
      today: '2026-11-08',
      txs: [
        { kind: 'expense', amountMinor: 5_437, date: '2026-11-04' },
        { kind: 'income', amountMinor: 234_567, date: '2026-11-02' },
        { kind: 'expense', amountMinor: 4_112, date: '2026-10-30' }, // last month
        { kind: 'expense', amountMinor: 10_000, date: '2026-11-03', transferId: 't' },
        { kind: 'expense', amountMinor: 999, date: '2026-11-20' }, // planned, not yet
      ],
    });
    expect(g).toEqual({
      comingMinor: 1_299 + 8_450,
      comingCount: 2,
      spentMinor: 5_437,
      freeMinor: 100_000 - 1_299 - 8_450,
    });
  });
});

describe('monthContext (polish p1: the widget line of "Diesen Monat")', () => {
  const money = (n: number) => `${(n / 100).toFixed(2)} €`;
  it('names what is due, then what was spent, both capitalised', () => {
    expect(
      monthContext(
        { comingCount: 2, comingMinor: 9_749, spentMinor: 12_000 },
        money,
        t.finance.ext.month,
      ),
    ).toBe('Kommt noch 97.49 € · Ausgegeben 120.00 €');
  });
  it('says "nothing spent yet" in words instead of a zero amount', () => {
    expect(
      monthContext({ comingCount: 0, comingMinor: 0, spentMinor: 0 }, money, t.finance.ext.month),
    ).toBe('Nichts mehr fällig · Noch nichts ausgegeben');
  });
});
