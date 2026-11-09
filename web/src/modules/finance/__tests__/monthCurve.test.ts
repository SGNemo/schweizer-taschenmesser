import { describe, expect, it } from 'vitest';
import { monthBalanceSeries } from '../balanceSeries';
import { curveScale } from '../components/MonthCurve';

const accounts = [{ id: 'a', openingBalanceMinor: 1_137_197 }];
const txs = [
  {
    accountId: 'a',
    categoryId: 'salary',
    kind: 'income' as const,
    amountMinor: 286_312,
    date: '2026-09-01',
  },
  {
    accountId: 'a',
    categoryId: 'food',
    kind: 'expense' as const,
    amountMinor: 161_876,
    date: '2026-09-15',
  },
];

describe('month curve (round 6, U42)', () => {
  const points = monthBalanceSeries(accounts, txs, '2026-09', '2026-09-29');

  it('the series starts at the opening balance ("Monatsbeginn"), before the first booking', () => {
    expect(points[0]).toEqual({ date: '2026-08-31', balanceMinor: 1_137_197 });
    expect(points[1]!.balanceMinor).toBe(1_137_197 + 286_312);
    expect(points.at(-1)!.balanceMinor).toBe(1_261_633);
  });

  it('the opening balance is drawn above the baseline, never as an empty account', () => {
    const { y, baseline } = curveScale(points.map((p) => p.balanceMinor));
    const start = y(points[0]!.balanceMinor);
    expect(start).toBeLessThan(baseline - 10);
    // Higher balances are higher on the chart.
    expect(y(points[1]!.balanceMinor)).toBeLessThan(start);
  });
});
