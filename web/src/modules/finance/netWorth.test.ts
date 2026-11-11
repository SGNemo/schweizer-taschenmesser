import { describe, expect, it } from 'vitest';
import { balances } from './logic';
import { changeOver, kindOf, lastMonths, netWorth, netWorthSeries } from './netWorth';
import { accountSchema } from './schema';

const acc = (id: string, openingBalanceMinor: number) => ({ id, openingBalanceMinor });
const tx = (date: string, kind: 'income' | 'expense', amountMinor: number, accountId = 'a') => ({
  accountId,
  categoryId: undefined,
  kind,
  amountMinor,
  date,
});

describe('lastMonths', () => {
  it('ends with the current month and crosses the year', () => {
    expect(lastMonths('2026-02-10', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('netWorthSeries', () => {
  it('gives the balance at each month end, opening balance included', () => {
    const txs = [
      tx('2026-07-31', 'income', 500),
      tx('2026-08-01', 'expense', 200),
      tx('2026-08-31', 'income', 50),
      tx('2026-09-10', 'expense', 100),
    ];
    const s = netWorthSeries([acc('a', 1000)], txs, '2026-09-15', 3);
    expect(s).toEqual([
      { month: '2026-07', valueMinor: 1500 },
      { month: '2026-08', valueMinor: 1350 },
      { month: '2026-09', valueMinor: 1250 },
    ]);
  });

  it('ignores bookings after today and carries empty months', () => {
    const txs = [tx('2026-07-05', 'income', 100), tx('2026-09-20', 'income', 999)];
    const s = netWorthSeries([acc('a', 0)], txs, '2026-09-15', 3);
    expect(s.map((p) => p.valueMinor)).toEqual([100, 100, 100]);
  });

  it('counts bookings before the window in the start value', () => {
    const s = netWorthSeries([acc('a', 100)], [tx('2025-01-01', 'income', 50)], '2026-09-15', 2);
    expect(s).toEqual([
      { month: '2026-08', valueMinor: 150 },
      { month: '2026-09', valueMinor: 150 },
    ]);
  });

  it('starts a late-opened account where it starts, no fake zero before', () => {
    const txs = [tx('2026-07-02', 'income', 100, 'a'), tx('2026-09-03', 'income', 10, 'b')];
    const s = netWorthSeries([acc('a', 0), acc('b', 5000)], txs, '2026-09-30', 3);
    expect(s).toEqual([
      { month: '2026-07', valueMinor: 100 },
      { month: '2026-08', valueMinor: 100 },
      { month: '2026-09', valueMinor: 5110 },
    ]);
  });

  it('leaves out months before any account started', () => {
    const s = netWorthSeries([acc('a', 0)], [tx('2026-09-01', 'income', 5)], '2026-09-15', 12);
    expect(s).toEqual([{ month: '2026-09', valueMinor: 5 }]);
  });

  it('does not double count a transfer', () => {
    const txs = [
      tx('2026-08-10', 'income', 1, 'a'),
      { ...tx('2026-09-05', 'expense', 300, 'a'), transferId: 't' },
      { ...tx('2026-09-05', 'income', 300, 'b'), transferId: 't' },
    ];
    const s = netWorthSeries([acc('a', 1000), acc('b', 0)], txs, '2026-09-30', 2);
    expect(s.map((p) => p.valueMinor)).toEqual([1001, 1001]);
  });

  it('counts an account with an opening balance but no bookings', () => {
    const ts = (d: string) => new Date(`${d}T12:00:00`).getTime();
    const accounts = [
      { ...acc('a', 0), createdAt: ts('2026-07-01') },
      { ...acc('s', 500000), createdAt: ts('2026-08-10') },
    ];
    const s = netWorthSeries(
      accounts,
      [tx('2026-07-05', 'income', 100), tx('2026-09-02', 'income', 100)],
      '2026-09-15',
      4,
    );
    expect(s).toEqual([
      { month: '2026-07', valueMinor: 100 },
      { month: '2026-08', valueMinor: 500100 },
      { month: '2026-09', valueMinor: 500200 },
    ]);
  });

  it('counts accounts of unknown age from the window start; the last point equals the balances', () => {
    const accounts = [acc('a', 0), acc('s', 500000)];
    const txs = [tx('2026-08-05', 'income', 100), tx('2026-09-02', 'expense', 30)];
    const s = netWorthSeries(accounts, txs, '2026-09-15', 12);
    expect(s).toHaveLength(12);
    const total = [...balances(accounts, txs, '2026-09-15').values()].reduce((x, y) => x + y, 0);
    expect(s[s.length - 1]!.valueMinor).toBe(total);
    expect(total).toBe(500070);
  });

  it('shows no history for a brand-new account with nothing else', () => {
    const created = new Date('2026-09-10T12:00:00').getTime();
    const s = netWorthSeries([{ ...acc('a', 1000), createdAt: created }], [], '2026-09-15');
    expect(s).toEqual([{ month: '2026-09', valueMinor: 1000 }]);
  });
});

describe('changeOver', () => {
  it('is the difference first to last, with the start month', () => {
    const pts = [
      { month: '2026-05', valueMinor: 1000 },
      { month: '2026-09', valueMinor: 700 },
    ];
    expect(changeOver(pts)).toEqual({ diffMinor: -300, since: '2026-05' });
  });
  it('is undefined for fewer than two points', () => {
    expect(changeOver([{ month: '2026-05', valueMinor: 1 }])).toBeUndefined();
  });
});

describe('netWorth', () => {
  const DAY = '2026-09-15';
  const account = (
    id: string,
    openingBalanceMinor: number,
    kind?: 'checking' | 'savings' | 'cash' | 'card',
    currency?: string,
  ) => ({ id, openingBalanceMinor, kind, currency });

  it('is empty without accounts', () => {
    expect(netWorth([], [], DAY)).toEqual([]);
    // Bookings of an account that is gone add nothing.
    expect(netWorth([], [tx('2026-09-01', 'income', 500)], DAY)).toEqual([]);
  });

  it('adds the signed balances and groups them by kind, in the order of the kinds', () => {
    const accounts = [
      account('cash', 6000, 'cash'),
      account('giro', 100000, 'checking'),
      account('tages', 500000, 'savings'),
      account('giro2', 2500, 'checking'),
    ];
    const txs = [tx('2026-09-01', 'expense', 40000, 'giro'), tx('2026-09-20', 'income', 9, 'giro')];
    const [w, ...rest] = netWorth(accounts, txs, DAY);
    expect(rest).toEqual([]);
    expect(w).toEqual({
      currency: 'EUR',
      totalMinor: 568500,
      accounts: 4,
      parts: [
        { kind: 'checking', valueMinor: 62500, accounts: 2 },
        { kind: 'savings', valueMinor: 500000, accounts: 1 },
        { kind: 'cash', valueMinor: 6000, accounts: 1 },
      ],
    });
    // The same number as the sum of the balances and as the last point of the curve.
    const sum = [...balances(accounts, txs, DAY).values()].reduce((a, b) => a + b, 0);
    expect(w!.totalMinor).toBe(sum);
    expect(netWorthSeries(accounts, txs, DAY, 12).at(-1)!.valueMinor).toBe(sum);
  });

  it('takes a card balance with the sign its bookings gave it: not negated, not negated twice', () => {
    const accounts = [account('giro', 100000, 'checking'), account('card', 0, 'card')];
    const txs = [tx('2026-09-03', 'expense', 25000, 'card')];
    const [w] = netWorth(accounts, txs, DAY);
    expect(w!.parts).toEqual([
      { kind: 'checking', valueMinor: 100000, accounts: 1 },
      { kind: 'card', valueMinor: -25000, accounts: 1 },
    ]);
    expect(w!.totalMinor).toBe(75000);
    // A card with credit on it (a refund, a prepaid card) stays positive.
    const [credit] = netWorth(
      [account('card', 0, 'card')],
      [tx('2026-09-04', 'income', 1500, 'card')],
      DAY,
    );
    expect(credit!.totalMinor).toBe(1500);
    // Paying the card off is a transfer: the parts move, the total does not.
    const paid = netWorth(
      accounts,
      [
        ...txs,
        tx('2026-09-10', 'expense', 25000, 'giro'),
        tx('2026-09-10', 'income', 25000, 'card'),
      ],
      DAY,
    )[0]!;
    expect(paid.totalMinor).toBe(75000);
    expect(paid.parts.map((p) => p.valueMinor)).toEqual([75000, 0]);
  });

  it('counts money put aside for a savings goal once: it lies on the savings account', () => {
    // 200 € go from the checking to the savings account for a goal. Goals (module Budgets) are no input of the
    // formula, so what is saved for one cannot be added on top of the account that holds it.
    const accounts = [account('giro', 100000, 'checking'), account('tages', 300000, 'savings')];
    const before = netWorth(accounts, [], DAY)[0]!;
    const after = netWorth(
      accounts,
      [tx('2026-09-05', 'expense', 20000, 'giro'), tx('2026-09-05', 'income', 20000, 'tages')],
      DAY,
    )[0]!;
    expect(before.totalMinor).toBe(400000);
    expect(after.totalMinor).toBe(400000);
    expect(after.parts).toEqual([
      { kind: 'checking', valueMinor: 80000, accounts: 1 },
      { kind: 'savings', valueMinor: 320000, accounts: 1 },
    ]);
  });

  it('keeps every currency apart: one entry each, the euro first, nothing converted', () => {
    const accounts = [
      account('usd', 50000, 'savings', 'USD'),
      account('giro', 100000, 'checking'),
      account('mxn', 900000, 'cash', 'MXN'),
    ];
    const txs = [tx('2026-09-02', 'expense', 10000, 'usd')];
    expect(netWorth(accounts, txs, DAY)).toEqual([
      {
        currency: 'EUR',
        totalMinor: 100000,
        accounts: 1,
        parts: [{ kind: 'checking', valueMinor: 100000, accounts: 1 }],
      },
      {
        currency: 'MXN',
        totalMinor: 900000,
        accounts: 1,
        parts: [{ kind: 'cash', valueMinor: 900000, accounts: 1 }],
      },
      {
        currency: 'USD',
        totalMinor: 40000,
        accounts: 1,
        parts: [{ kind: 'savings', valueMinor: 40000, accounts: 1 }],
      },
    ]);
  });

  it('reads an account without a kind as a checking account and writes nothing back', () => {
    const old = { id: 'old', ...accountSchema.parse({ name: 'Konto', openingBalanceMinor: 1234 }) };
    expect(old.kind).toBeUndefined();
    expect(kindOf(old)).toBe('checking');
    const frozen = Object.freeze(old);
    expect(netWorth([frozen, account('s', 10, 'savings')], [], DAY)[0]!.parts).toEqual([
      { kind: 'checking', valueMinor: 1234, accounts: 1 },
      { kind: 'savings', valueMinor: 10, accounts: 1 },
    ]);
    expect(frozen.kind).toBeUndefined();
  });

  it('stays in whole cents', () => {
    const [w] = netWorth(
      [account('a', 1, 'cash'), account('b', -3, 'card')],
      [tx('2026-09-01', 'income', 33, 'a')],
      DAY,
    );
    expect(Number.isInteger(w!.totalMinor)).toBe(true);
    expect(w!.totalMinor).toBe(31);
  });
});
