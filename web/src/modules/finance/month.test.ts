import { describe, expect, it } from 'vitest';
import { monthGlance } from './month';

// Round 5, person B: one rough card "Diesen Monat" – fixed still coming, spent, free.
describe('monthGlance', () => {
  it('counts what is still coming this month, what was spent and what stays free', () => {
    const g = monthGlance({
      balanceMinor: 100_000,
      today: '2026-11-08',
      txs: [
        { kind: 'expense', amountMinor: 5_437, date: '2026-11-04' },
        { kind: 'expense', amountMinor: 89_000, date: '2026-11-01' },
        { kind: 'income', amountMinor: 234_567, date: '2026-11-02' },
        { kind: 'expense', amountMinor: 4_112, date: '2026-10-30' }, // last month
        { kind: 'expense', amountMinor: 10_000, date: '2026-11-03', transferId: 't' },
        { kind: 'expense', amountMinor: 999, date: '2026-11-20' }, // planned, not yet
      ],
      charges: [
        { date: '2026-11-08', amountMinor: 500 }, // today: booked already
        { date: '2026-11-15', amountMinor: 1_299 },
        { date: '2026-12-03', amountMinor: 2_990 }, // next month
      ],
      invoices: [
        { dueDate: '2026-11-20', amountMinor: 8_450 },
        { dueDate: '2026-10-20', amountMinor: 1_000 }, // overdue: still to pay
        { dueDate: '2026-12-20', amountMinor: 7_000 },
      ],
    });
    expect(g).toEqual({
      comingMinor: 1_299 + 8_450 + 1_000,
      comingCount: 3,
      spentMinor: 5_437 + 89_000,
      freeMinor: 100_000 - (1_299 + 8_450 + 1_000),
    });
  });
});
