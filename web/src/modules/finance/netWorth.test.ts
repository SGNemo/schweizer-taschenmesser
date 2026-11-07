import { describe, expect, it } from 'vitest';
import { balances } from './logic';
import { changeOver, lastMonths, netWorthSeries } from './netWorth';

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
