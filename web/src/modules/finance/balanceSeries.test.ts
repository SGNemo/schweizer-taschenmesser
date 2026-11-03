import { describe, expect, it } from 'vitest';
import { monthBalanceSeries } from './balanceSeries';

const acc = (id: string, openingBalanceMinor: number) => ({ id, openingBalanceMinor });
const tx = (date: string, kind: 'income' | 'expense', amountMinor: number, accountId = 'a') => ({
  accountId,
  categoryId: undefined,
  kind,
  amountMinor,
  date,
});

describe('monthBalanceSeries', () => {
  it('starts with the balance before the month and follows every booking', () => {
    const txs = [
      tx('2026-08-30', 'income', 500),
      tx('2026-09-02', 'expense', 200),
      tx('2026-09-02', 'income', 50),
      tx('2026-09-04', 'income', 1000),
    ];
    const s = monthBalanceSeries([acc('a', 1000)], txs, '2026-09', '2026-09-05');
    expect(s[0]).toEqual({ date: '2026-08-31', balanceMinor: 1500 });
    expect(s.map((p) => p.date)).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
    ]);
    expect(s.map((p) => p.balanceMinor)).toEqual([1500, 1500, 1350, 1350, 2350, 2350]);
  });

  it('stops at `through` in the running month and covers all days of a past month', () => {
    expect(monthBalanceSeries([acc('a', 0)], [], '2026-09', '2026-09-10')).toHaveLength(11);
    expect(monthBalanceSeries([acc('a', 0)], [], '2026-09', '2026-12-31')).toHaveLength(31);
  });

  it('sums several accounts and ignores bookings of accounts that are not in the list', () => {
    const txs = [tx('2026-09-01', 'expense', 100, 'a'), tx('2026-09-01', 'expense', 999, 'other')];
    const s = monthBalanceSeries([acc('a', 500), acc('b', 300)], txs, '2026-09', '2026-09-01');
    expect(s.map((p) => p.balanceMinor)).toEqual([800, 700]);
  });
});
