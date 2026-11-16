import { describe, expect, it } from 'vitest';
import type { paidFlows } from '../overview';
import { invoiceOverview, mainCurrency, OVERVIEW_MONTHS } from '../overview';

const DAY = '2026-11-15';
let n = 0;
const inv = (o: Partial<Parameters<typeof paidFlows>[0]> = {}) => ({
  id: `i${++n}`,
  payee: 'Stadtwerke',
  amountMinor: 10000,
  dueDate: '2026-11-20',
  status: 'open' as const,
  ...o,
});

describe('invoice overview', () => {
  it('counts open, late (the day after the due date) and the open sum after part payments', () => {
    const o = invoiceOverview(
      [
        inv({ dueDate: DAY }), // due today: open, not late
        inv({
          dueDate: '2026-11-14',
          payments: [{ id: 'p', date: '2026-11-01', amountMinor: 2500 }],
        }),
        inv({ status: 'paid', paidAt: '2026-11-02' }),
      ],
      DAY,
    );
    expect(o.open).toEqual({ minor: 17500, count: 2 });
    expect(o.late).toEqual({ minor: 7500, count: 1 });
  });

  it('paid this month: part payments on their day, the rest on the day it was marked paid', () => {
    const o = invoiceOverview(
      [
        // Part paid in October, the rest in November: only the rest counts for November.
        inv({
          status: 'paid',
          paidAt: '2026-11-03',
          payments: [{ id: 'p', date: '2026-10-10', amountMinor: 4000 }],
        }),
        // Still open, part paid this month: the part counts.
        inv({ payments: [{ id: 'q', date: '2026-11-05', amountMinor: 1000 }] }),
        inv({ status: 'paid', paidAt: '2026-09-30' }),
      ],
      DAY,
    );
    expect(o.paidMonth).toEqual({ minor: 7000, count: 2 });
    expect(o.months).toHaveLength(OVERVIEW_MONTHS);
    expect(o.months.at(-1)).toEqual({ month: '2026-11', minor: 7000 });
    expect(o.months.at(-2)).toEqual({ month: '2026-10', minor: 4000 });
    expect(o.months.at(-3)).toEqual({ month: '2026-09', minor: 10000 });
    expect(o.months[0]!.month).toBe('2025-12');
  });

  it('leaves out money older than the window and dates in the future', () => {
    const o = invoiceOverview(
      [
        inv({ status: 'paid', paidAt: '2025-11-30' }),
        inv({ status: 'paid', paidAt: '2026-12-01' }),
      ],
      DAY,
    );
    expect(o.months.every((m) => m.minor === 0)).toBe(true);
    expect(o.paidByPayee).toEqual([]);
  });

  it('groups payees whatever the case and spaces, largest first', () => {
    const o = invoiceOverview(
      [
        inv({ payee: 'Stadtwerke ', amountMinor: 3000 }),
        inv({ payee: 'stadtwerke', amountMinor: 2000 }),
        inv({ payee: 'Telekom', amountMinor: 9000 }),
        inv({ payee: 'Telekom', status: 'paid', paidAt: '2026-11-01', amountMinor: 4000 }),
      ],
      DAY,
    );
    expect(o.openByPayee.map((p) => [p.label, p.value])).toEqual([
      ['Telekom', 9000],
      ['Stadtwerke', 5000],
    ]);
    expect(o.paidByPayee.map((p) => [p.label, p.value])).toEqual([['Telekom', 4000]]);
  });

  it('uses the currency most invoices have and names how many were left out', () => {
    expect(mainCurrency([])).toBe('EUR');
    const o = invoiceOverview(
      [inv({ currency: 'USD' }), inv({ currency: 'USD' }), inv({}), inv({ currency: 'XXX1' })],
      DAY,
    );
    expect(o.currency).toBe('USD');
    // No currency and an invalid one both read as euro.
    expect(o.skipped).toBe(2);
    expect(o.open.count).toBe(2);
  });

  it('a fully part-paid invoice that is still open counts as nothing open', () => {
    const o = invoiceOverview(
      [inv({ payments: [{ id: 'p', date: '2026-11-01', amountMinor: 10000 }] })],
      DAY,
    );
    expect(o.open.count).toBe(0);
  });
});
