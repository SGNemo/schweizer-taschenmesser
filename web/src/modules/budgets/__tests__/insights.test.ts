import { describe, expect, it } from 'vitest';
import { dailyRate, headTotals, monthlyShare, rollUp, trendValues } from '../insights';

describe('dailyRate', () => {
  it('spreads the free amount over the days left, today included', () => {
    // 15th to 30th = 16 days; 160,00 € → 10,00 € a day.
    expect(dailyRate(16000, '2026-11-01', '2026-11-30', '2026-11-15')).toEqual({
      perDay: 1000,
      daysLeft: 16,
    });
  });
  it('rounds down so the days together never exceed what is free', () => {
    expect(dailyRate(1000, '2026-11-01', '2026-11-30', '2026-11-28')).toEqual({
      perDay: 333,
      daysLeft: 3,
    });
  });
  it('has one day left on the last day and 0 when nothing is free', () => {
    expect(dailyRate(500, '2026-11-01', '2026-11-30', '2026-11-30')).toEqual({
      perDay: 500,
      daysLeft: 1,
    });
    expect(dailyRate(-200, '2026-11-01', '2026-11-30', '2026-11-10')?.perDay).toBe(0);
  });
  it('is none outside the period', () => {
    expect(dailyRate(1000, '2026-11-01', '2026-11-30', '2026-12-01')).toBeUndefined();
    expect(dailyRate(1000, '2026-11-01', '2026-11-30', '2026-10-31')).toBeUndefined();
  });
});

describe('monthlyShare', () => {
  it('counts a quarter a third and a year a twelfth', () => {
    expect(monthlyShare(30000, 'month')).toBe(30000);
    expect(monthlyShare(30000, 'quarter')).toBe(10000);
    expect(monthlyShare(120000, 'year')).toBe(10000);
    expect(monthlyShare(100, 'quarter')).toBe(33);
  });
});

describe('rollUp', () => {
  const cats = [
    { id: 'food' },
    { id: 'restaurant', parentId: 'food' },
    { id: 'orphan', parentId: 'gone' },
  ];
  it('adds children to their parent and keeps the rest', () => {
    const out = rollUp(
      new Map([
        ['food', 1000],
        ['restaurant', 500],
        ['orphan', 200],
        ['', 300],
        ['zero', 0],
      ]),
      cats,
    );
    expect(Object.fromEntries(out)).toEqual({ food: 1500, orphan: 200, '': 300 });
  });
});

describe('headTotals', () => {
  it('sums the running monthly budgets only; an overrun does not eat another rest', () => {
    const t = headTotals([
      { period: 'month', running: true, spent: 30000, limit: 40000, projected: 38000 },
      { period: 'month', running: true, spent: 12000, limit: 10000, projected: 14000 },
      { period: 'quarter', running: true, spent: 1000, limit: 90000, projected: 5000 },
      { period: 'month', running: false, spent: 5, limit: 10 },
    ]);
    expect(t).toEqual({ limit: 50000, spent: 42000, free: 10000, projected: 52000, count: 2 });
  });
  it('has no forecast when one budget has none (setting off) or there are no monthly budgets', () => {
    expect(
      headTotals([
        { period: 'month', running: true, spent: 1, limit: 2, projected: 2 },
        { period: 'month', running: true, spent: 1, limit: 2 },
      ]).projected,
    ).toBeUndefined();
    expect(headTotals([]).projected).toBeUndefined();
    expect(headTotals([]).count).toBe(0);
  });
});

describe('trendValues', () => {
  const months = ['2026-07', '2026-08', '2026-09', '2026-10'];
  it('leaves months before the first booking and months to come as gaps', () => {
    expect(trendValues(months, [0, 500, 0, 0], [false, true, false, false], '2026-09')).toEqual([
      null,
      500,
      0,
      null,
    ]);
  });
  it('is all gaps without any booking', () => {
    expect(trendValues(months, [0, 0, 0, 0], [false, false, false, false], '2026-12')).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });
});
