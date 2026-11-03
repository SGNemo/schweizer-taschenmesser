import { describe, expect, it } from 'vitest';
import {
  applyBookingFilter,
  categoryDeltas,
  compareMonths,
  delta,
  findPossibleDuplicate,
  rollupExpenses,
  rollupYear,
  yearSummary,
} from './analysis';
import { categoryParts, isTransfer, monthSummary, nextRepeatDate, planRepeats, splitsValid } from './logic';
import { buildTransfer, transferValid } from './transfer';
import { bookingsCsv } from './export';
import { buildForecast, horizonEnd } from './forecast';
import type { Transaction } from './schema';

const tx = (o: Partial<Transaction> & Pick<Transaction, 'date' | 'amountMinor'>): Transaction => ({
  accountId: 'a1',
  kind: 'expense',
  ...o,
});

const CATS = [
  { id: 'food', name: 'Food', kind: 'expense' as const },
  { id: 'super', name: 'Supermarket', kind: 'expense' as const, parentId: 'food' },
  { id: 'market', name: 'Market', kind: 'expense' as const, parentId: 'food' },
  { id: 'home', name: 'Home', kind: 'expense' as const },
  { id: 'orphan', name: 'Orphan', kind: 'expense' as const, parentId: 'gone' },
];

describe('transfers', () => {
  it('builds two linked bookings without category or payee', () => {
    const { out, in: inn } = buildTransfer(
      { fromAccountId: 'a', toAccountId: 'b', amountMinor: 5000, date: '2026-03-05' },
      't1',
    );
    expect(out).toMatchObject({ accountId: 'a', kind: 'expense', transferId: 't1' });
    expect(inn).toMatchObject({ accountId: 'b', kind: 'income', transferId: 't1' });
    expect(out.categoryId).toBeUndefined();
    expect(isTransfer(out)).toBe(true);
  });

  it.each([
    [{ fromAccountId: 'a', toAccountId: 'b', amountMinor: 1, date: 'x' }, true],
    [{ fromAccountId: 'a', toAccountId: 'a', amountMinor: 1, date: 'x' }, false],
    [{ fromAccountId: 'a', toAccountId: 'b', amountMinor: 0, date: 'x' }, false],
    [{ fromAccountId: '', toAccountId: 'b', amountMinor: 5, date: 'x' }, false],
  ])('validates %j → %s', (draft, ok) => expect(transferValid(draft)).toBe(ok));

  it('is neither income nor expense in the month summary', () => {
    const { out, in: inn } = buildTransfer(
      { fromAccountId: 'a', toAccountId: 'b', amountMinor: 9000, date: '2026-03-05' },
      't',
    );
    const rows = [out, inn, tx({ date: '2026-03-06', amountMinor: 1000 })];
    expect(monthSummary(rows, '2026-03')).toEqual({ income: 0, expense: 1000, net: -1000 });
  });
});

describe('splits', () => {
  it.each([
    [1000, [{ amountMinor: 600 }, { amountMinor: 400 }], true],
    [1000, [{ amountMinor: 600 }, { amountMinor: 300 }], false],
    [1000, [{ amountMinor: 1000 }], false],
    [1000, [], false],
  ])('splitsValid(%i, %j) = %s', (amount, splits, ok) => expect(splitsValid(amount, splits)).toBe(ok));

  it('categoryParts falls back to the one category', () => {
    expect(categoryParts({ categoryId: 'food', amountMinor: 500 })).toEqual([
      { categoryId: 'food', amountMinor: 500 },
    ]);
    expect(
      categoryParts({
        categoryId: 'food',
        amountMinor: 500,
        splits: [
          { categoryId: 'super', amountMinor: 300 },
          { categoryId: 'home', amountMinor: 200 },
        ],
      }),
    ).toEqual([
      { categoryId: 'super', amountMinor: 300 },
      { categoryId: 'home', amountMinor: 200 },
    ]);
  });
});

describe('roll-up of sub-categories', () => {
  const rows = [
    tx({ date: '2026-03-02', amountMinor: 3000, categoryId: 'super' }),
    tx({ date: '2026-03-03', amountMinor: 1500, categoryId: 'market' }),
    tx({ date: '2026-03-04', amountMinor: 500, categoryId: 'food' }),
    tx({ date: '2026-03-05', amountMinor: 2000, categoryId: 'home' }),
    tx({ date: '2026-03-06', amountMinor: 700, categoryId: 'orphan' }),
    tx({ date: '2026-03-07', amountMinor: 100 }),
    tx({
      date: '2026-03-08',
      amountMinor: 1000,
      categoryId: 'food',
      splits: [
        { categoryId: 'super', amountMinor: 600 },
        { categoryId: 'home', amountMinor: 400 },
      ],
    }),
    tx({ date: '2026-04-01', amountMinor: 9999, categoryId: 'home' }),
  ];

  it('folds children into the parent and lists them below, splits included', () => {
    const r = rollupExpenses(rows, '2026-03', CATS);
    const food = r.find((x) => x.categoryId === 'food')!;
    expect(food.amountMinor).toBe(3000 + 1500 + 500 + 600);
    expect(food.children).toEqual([
      { categoryId: 'super', amountMinor: 3600 },
      { categoryId: 'market', amountMinor: 1500 },
    ]);
    expect(r.find((x) => x.categoryId === 'home')!.amountMinor).toBe(2400);
  });

  it('a category whose parent is gone counts as top, uncategorised stays undefined', () => {
    const r = rollupExpenses(rows, '2026-03', CATS);
    expect(r.find((x) => x.categoryId === 'orphan')!.amountMinor).toBe(700);
    expect(r.find((x) => x.categoryId === undefined)!.amountMinor).toBe(100);
  });

  it('sums to the month expense (nothing lost or doubled)', () => {
    const total = rollupExpenses(rows, '2026-03', CATS).reduce((s, x) => s + x.amountMinor, 0);
    expect(total).toBe(monthSummary(rows, '2026-03').expense);
  });

  it('year roll-up merges the months', () => {
    expect(rollupYear(rows, 2026, CATS).find((x) => x.categoryId === 'home')!.amountMinor).toBe(2400 + 9999);
  });
});

describe('comparison', () => {
  it.each([
    [150, 100, 50, 50],
    [50, 100, -50, -50],
    [0, 100, -100, -100],
    [100, 0, 100, undefined],
    [0, 0, 0, undefined],
    [101, 300, -199, -66], // −66.33 → −66
    [2, 3, -1, -33],
    [5, 3, 2, 67], // 66.67 → 67
  ])('delta(%i, %i)', (cur, prev, diff, pct) => {
    expect(delta(cur, prev)).toEqual(pct === undefined ? { diffMinor: diff } : { diffMinor: diff, percent: pct });
  });

  it('compares with the previous calendar month, also across the year change', () => {
    const rows = [
      tx({ date: '2025-12-10', amountMinor: 1000 }),
      tx({ date: '2026-01-10', amountMinor: 1500 }),
      tx({ date: '2026-01-11', amountMinor: 4000, kind: 'income' }),
    ];
    const c = compareMonths(rows, '2026-01');
    expect(c.expense).toEqual({ diffMinor: 500, percent: 50 });
    expect(c.income).toEqual({ diffMinor: 4000 });
  });

  it('per-category deltas', () => {
    const rows = [
      tx({ date: '2026-02-10', amountMinor: 2000, categoryId: 'home' }),
      tx({ date: '2026-03-10', amountMinor: 2500, categoryId: 'home' }),
      tx({ date: '2026-03-11', amountMinor: 700, categoryId: 'food' }),
    ];
    const d = categoryDeltas(rows, '2026-03', CATS);
    expect(d.get('home')).toEqual({ diffMinor: 500, percent: 25 });
    expect(d.get('food')).toEqual({ diffMinor: 700 });
  });
});

describe('year summary', () => {
  it('sums twelve months and the savings rate (rounded)', () => {
    const rows = [
      tx({ date: '2026-01-15', amountMinor: 300000, kind: 'income' }),
      tx({ date: '2026-02-15', amountMinor: 300000, kind: 'income' }),
      tx({ date: '2026-01-20', amountMinor: 200000 }),
      tx({ date: '2026-12-31', amountMinor: 100001 }),
      tx({ date: '2025-12-31', amountMinor: 999999 }),
    ];
    const y = yearSummary(rows, 2026);
    expect(y.months).toHaveLength(12);
    expect(y.income).toBe(600000);
    expect(y.expense).toBe(300001);
    expect(y.savingsRate).toBe(50); // 49.9998 → 50
  });
  it('has no savings rate without income', () => {
    expect(yearSummary([tx({ date: '2026-01-01', amountMinor: 5 })], 2026).savingsRate).toBeUndefined();
  });
});

describe('filter', () => {
  const rows = [
    tx({ date: '2026-03-02', amountMinor: 3000, categoryId: 'super' }),
    tx({ date: '2026-03-03', amountMinor: 1500, categoryId: 'home', accountId: 'a2' }),
    tx({ date: '2026-03-04', amountMinor: 8000, kind: 'income' }),
    { ...buildTransfer({ fromAccountId: 'a1', toAccountId: 'a2', amountMinor: 700, date: '2026-03-05' }, 't').out },
  ];
  it('hides transfers by default', () => expect(applyBookingFilter(rows, {}, CATS)).toHaveLength(3));
  it('shows them on request', () =>
    expect(applyBookingFilter(rows, { withTransfers: true }, CATS)).toHaveLength(4));
  it('category includes its children', () =>
    expect(applyBookingFilter(rows, { categoryId: 'food' }, CATS).map((r) => r.amountMinor)).toEqual([3000]));
  it('amount range is inclusive, account and kind narrow', () => {
    expect(applyBookingFilter(rows, { minMinor: 1500, maxMinor: 3000 }, CATS)).toHaveLength(2);
    expect(applyBookingFilter(rows, { accountId: 'a2' }, CATS)).toHaveLength(1);
    expect(applyBookingFilter(rows, { kind: 'income' }, CATS)).toHaveLength(1);
  });
  it('date range is inclusive', () =>
    expect(applyBookingFilter(rows, { from: '2026-03-03', to: '2026-03-04' }, CATS)).toHaveLength(2));
});

describe('possible duplicate', () => {
  const existing = [{ ...tx({ date: '2026-03-10', amountMinor: 1250, payee: 'Café Rot' }), id: 'x1' }];
  const draft = { accountId: 'a1', kind: 'expense' as const, amountMinor: 1250, payee: 'café rot' };
  it.each([
    ['2026-03-10', true],
    ['2026-03-12', true],
    ['2026-03-13', false],
    ['2026-03-08', true],
    ['2026-03-07', false],
  ])('on %s → %s', (date, hit) =>
    expect(Boolean(findPossibleDuplicate(existing, { ...draft, date }))).toBe(hit),
  );
  it('ignores itself, other amounts and other accounts', () => {
    expect(findPossibleDuplicate(existing, { ...draft, date: '2026-03-10' }, 'x1')).toBeUndefined();
    expect(findPossibleDuplicate(existing, { ...draft, date: '2026-03-10', amountMinor: 1251 })).toBeUndefined();
    expect(findPossibleDuplicate(existing, { ...draft, date: '2026-03-10', accountId: 'a2' })).toBeUndefined();
  });
});

describe('repeat dates', () => {
  it.each([
    ['2026-03-01', 'weekly', '2026-03-08'],
    ['2026-12-28', 'weekly', '2027-01-04'],
    ['2026-02-23', 'weekly', '2026-03-02'],
    ['2026-01-31', 'monthly', '2026-02-28'],
    ['2028-01-31', 'monthly', '2028-02-29'],
    ['2026-11-30', 'quarterly', '2027-02-28'],
    ['2028-02-29', 'yearly', '2029-02-28'],
  ] as const)('%s %s → %s', (from, repeat, to) => expect(nextRepeatDate(from, repeat)).toBe(to));

  it('catches up weekly series up to today, newest keeps the series', () => {
    const head = { ...tx({ date: '2026-03-01', amountMinor: 500, repeat: 'weekly' }), id: 'h' };
    const { create, clear } = planRepeats([head], '2026-03-16');
    expect(create.map((c) => c.id)).toEqual(['rep-h-2026-03-08', 'rep-h-2026-03-15']);
    expect(create[0]!.data.repeat).toBeUndefined();
    expect(create[1]!.data.repeat).toBe('weekly');
    expect(clear).toEqual(['h']);
  });
});

describe('forecast', () => {
  const base = { today: '2026-03-10', to: '2026-03-31', balanceMinor: 100000, repeatHeads: [], subscriptionCharges: [], openInvoices: [] };

  it.each([
    ['2026-02-10', 'month', '2026-02-28'],
    ['2028-02-10', 'month', '2028-02-29'],
    ['2026-12-10', 'month', '2026-12-31'],
    ['2026-03-10', '30', '2026-04-09'],
    ['2026-12-10', '90', '2027-03-10'],
  ] as const)('horizon from %s (%s) ends %s', (today, h, end) => expect(horizonEnd(today, h)).toBe(end));

  it('without anything known the line is flat', () => {
    const f = buildForecast(base);
    expect(f.events).toEqual([]);
    expect(f.end.balanceMinor).toBe(100000);
    expect(f.lowest.balanceMinor).toBe(100000);
  });

  it('orders events, finds the lowest point and the end balance', () => {
    const f = buildForecast({
      ...base,
      repeatHeads: [
        { kind: 'income', amountMinor: 200000, date: '2026-02-25', payee: 'Salary', repeat: 'monthly' },
        { kind: 'expense', amountMinor: 80000, date: '2026-03-01', payee: 'Rent', repeat: 'monthly' },
      ],
      subscriptionCharges: [{ date: '2026-03-12', amountMinor: 1299, name: 'Stream' }],
      openInvoices: [
        { dueDate: '2026-03-15', amountMinor: 150000, payee: 'Tax' },
        { dueDate: '2026-04-02', amountMinor: 5, payee: 'Later' },
      ],
    });
    // Rent 2026-04-01 and salary 2026-03-25 → salary only inside March; rent is in April (out of range).
    expect(f.events.map((e) => [e.date, e.amountMinor])).toEqual([
      ['2026-03-12', -1299],
      ['2026-03-15', -150000],
      ['2026-03-25', 200000],
    ]);
    expect(f.lowest).toEqual({ date: '2026-03-15', balanceMinor: 100000 - 1299 - 150000 });
    expect(f.end.balanceMinor).toBe(100000 - 1299 - 150000 + 200000);
  });

  it('puts overdue items on today and never counts a subscription that is also a repeating booking', () => {
    const f = buildForecast({
      ...base,
      repeatHeads: [{ kind: 'expense', amountMinor: 999, date: '2026-02-20', payee: 'Music', repeat: 'monthly' }],
      subscriptionCharges: [{ date: '2026-03-20', amountMinor: 999, name: 'music' }],
      openInvoices: [{ dueDate: '2026-03-01', amountMinor: 5000, payee: 'Overdue' }],
    });
    expect(f.events.filter((e) => e.source === 'subscription')).toEqual([]);
    expect(f.events.find((e) => e.source === 'invoice')!.date).toBe('2026-03-10');
    expect(f.events.filter((e) => e.source === 'repeat')).toHaveLength(1);
  });

  it('expands weekly series over the horizon', () => {
    const f = buildForecast({
      ...base,
      to: '2026-04-09',
      repeatHeads: [{ kind: 'expense', amountMinor: 1000, date: '2026-03-09', payee: 'Class', repeat: 'weekly' }],
    });
    expect(f.events.map((e) => e.date)).toEqual(['2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06']);
    expect(f.end.balanceMinor).toBe(100000 - 4000);
  });
});

describe('export', () => {
  const labels = { header: ['Date', 'Account', 'Payee', 'Category', 'Kind', 'Amount', 'Note'], expense: 'Expense', income: 'Income', transfer: 'Transfer' };
  const acc = (id: string) => (id === 'a1' ? 'Checking' : 'Cash');
  const cat = (id?: string) => CATS.find((c) => c.id === id)?.name ?? '';

  it('writes signed amounts with a dot, one row per split part, ordered by date', () => {
    const csv = bookingsCsv(
      [
        tx({ date: '2026-03-09', amountMinor: 1000, payee: 'Shop; "X"', splits: [{ categoryId: 'super', amountMinor: 650 }, { categoryId: 'home', amountMinor: 350 }] }),
        tx({ date: '2026-03-01', amountMinor: 250000, kind: 'income', payee: 'Job' }),
        { ...buildTransfer({ fromAccountId: 'a1', toAccountId: 'a2', amountMinor: 5, date: '2026-03-10' }, 't').out },
      ],
      acc,
      cat,
      labels,
    );
    expect(csv.split(/\r?\n/).filter(Boolean)).toEqual([
      'Date;Account;Payee;Category;Kind;Amount;Note',
      '2026-03-01;Checking;Job;;Income;2500.00;',
      '2026-03-09;Checking;"Shop; ""X""";Supermarket;Expense;-6.50;',
      '2026-03-09;Checking;"Shop; ""X""";Home;Expense;-3.50;',
      '2026-03-10;Checking;;Transfer;Transfer;-0.05;',
    ]);
  });
});
