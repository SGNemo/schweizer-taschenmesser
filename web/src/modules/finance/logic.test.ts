import { describe, expect, it } from 'vitest';
import {
  accountBalance,
  availability,
  balances,
  expensesByCategory,
  monthSummary,
  monthlyTrend,
  OTHERS,
  UNCATEGORISED,
} from './logic';

const tx = (over: Record<string, unknown>) => ({
  accountId: 'a1',
  kind: 'expense' as const,
  amountMinor: 1000,
  date: '2026-09-10',
  ...over,
});

describe('balances', () => {
  it('opening balance plus income minus expenses, up to the given day', () => {
    const txs = [
      tx({ kind: 'income', amountMinor: 250000, date: '2026-09-01' }),
      tx({ amountMinor: 4550, date: '2026-09-05' }),
      tx({ amountMinor: 9999, date: '2026-10-01' }), // in the future
    ];
    expect(accountBalance({ openingBalanceMinor: 10000 }, txs, '2026-09-29')).toBe(
      10000 + 250000 - 4550,
    );
    expect(accountBalance({ openingBalanceMinor: 10000 }, txs, '2026-10-01')).toBe(
      10000 + 250000 - 4550 - 9999,
    );
    expect(accountBalance({ openingBalanceMinor: -500 }, [], '2026-09-29')).toBe(-500);
  });

  it('computes per account', () => {
    const map = balances(
      [
        { id: 'a1', openingBalanceMinor: 0 },
        { id: 'a2', openingBalanceMinor: 1000 },
      ],
      [
        tx({ accountId: 'a1', kind: 'income', amountMinor: 500 }),
        tx({ accountId: 'a2', amountMinor: 300 }),
      ],
      '2026-09-29',
    );
    expect(map.get('a1')).toBe(500);
    expect(map.get('a2')).toBe(700);
  });
});

describe('month views', () => {
  const txs = [
    tx({ kind: 'income', amountMinor: 300000, date: '2026-09-01' }),
    tx({ amountMinor: 12000, date: '2026-09-15', categoryId: 'food' }),
    tx({ amountMinor: 3000, date: '2026-09-16', categoryId: 'food' }),
    tx({ amountMinor: 8000, date: '2026-09-20', categoryId: 'home' }),
    tx({ amountMinor: 500, date: '2026-09-21' }),
    tx({ amountMinor: 700, date: '2026-09-22', categoryId: 'deleted-category' }),
    tx({ amountMinor: 99999, date: '2026-08-31' }),
  ];
  const cats = [
    { id: 'food', name: 'Lebensmittel' },
    { id: 'home', name: 'Wohnen' },
  ];

  it('summarises a month', () => {
    expect(monthSummary(txs, '2026-09')).toEqual({ income: 300000, expense: 24200, net: 275800 });
    expect(monthSummary(txs, '2027-01')).toEqual({ income: 0, expense: 0, net: 0 });
  });

  it('groups expenses by category, largest first; unknown categories count as uncategorised', () => {
    expect(expensesByCategory(txs, '2026-09', cats)).toEqual([
      { categoryId: 'food', name: 'Lebensmittel', amountMinor: 15000 },
      { categoryId: 'home', name: 'Wohnen', amountMinor: 8000 },
      { categoryId: undefined, name: UNCATEGORISED, amountMinor: 1200 },
    ]);
  });

  it('folds the tail into "Weitere"', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ id: `c${i}`, name: `K${i}` }));
    const t = many.map((c, i) => tx({ categoryId: c.id, amountMinor: (5 - i) * 100 }));
    const rows = expensesByCategory(t, '2026-09', many, 3);
    expect(rows.map((r) => [r.name, r.amountMinor])).toEqual([
      ['K0', 500],
      ['K1', 400],
      [OTHERS, 300 + 200 + 100],
    ]);
  });

  it('builds a trend of the last N months including empty ones', () => {
    const trend = monthlyTrend(txs, '2026-09', 3);
    expect(trend.map((p) => p.month)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(trend.map((p) => p.expense)).toEqual([0, 99999, 24200]);
    expect(trend[2]!.income).toBe(300000);
    expect(trend[2]!.label).toMatch(/^Sep/);
  });
});

describe('availability', () => {
  it('subtracts open invoices and expected subscription charges', () => {
    expect(availability(200000, 32000, 4599)).toEqual({
      balance: 200000,
      openInvoices: 32000,
      subscriptions: 4599,
      available: 163401,
    });
  });

  it('can be negative', () => {
    expect(availability(1000, 5000, 0).available).toBe(-4000);
  });
});
