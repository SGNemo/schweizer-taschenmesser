import { describe, expect, it } from 'vitest';
import {
  budgetStatus,
  carryIn,
  effectiveLimit,
  familyOf,
  goalPace,
  goalPlan,
  goalProgress,
  paceReachedOn,
  projectedSpend,
  spentInMonths,
} from '../compute';
import { elapsedIn, pastPeriodMonths, periodOf, previousPeriodMonth } from '../period';

describe('periods (expectation table)', () => {
  const rows: [string, string, 'month' | 'quarter' | 'year', string[], string, string][] = [
    ['month', '2026-02', 'month', ['2026-02'], '2026-02-01', '2026-02-28'],
    ['leap month', '2028-02', 'month', ['2028-02'], '2028-02-01', '2028-02-29'],
    [
      'quarter 1 (from February)',
      '2026-02',
      'quarter',
      ['2026-01', '2026-02', '2026-03'],
      '2026-01-01',
      '2026-03-31',
    ],
    [
      'quarter 2 (first month)',
      '2026-04',
      'quarter',
      ['2026-04', '2026-05', '2026-06'],
      '2026-04-01',
      '2026-06-30',
    ],
    [
      'quarter 4 (last month)',
      '2026-12',
      'quarter',
      ['2026-10', '2026-11', '2026-12'],
      '2026-10-01',
      '2026-12-31',
    ],
    [
      'year',
      '2026-07',
      'year',
      Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`),
      '2026-01-01',
      '2026-12-31',
    ],
  ];
  it.each(rows)('%s', (_n, month, period, months, from, to) => {
    const p = periodOf(month, period);
    expect(p.months).toEqual(months);
    expect(p.from).toBe(from);
    expect(p.to).toBe(to);
  });

  it('numbers quarters and months', () => {
    expect(periodOf('2026-05', 'quarter')).toMatchObject({ year: 2026, index: 2 });
    expect(periodOf('2026-05', 'month')).toMatchObject({ year: 2026, index: 5 });
    expect(periodOf('2026-05', 'year')).toMatchObject({ year: 2026, index: 1 });
  });

  it.each([
    ['2026-03', 'month', '2026-02'],
    ['2026-01', 'month', '2025-12'],
    ['2026-05', 'quarter', '2026-01'],
    ['2026-01', 'quarter', '2025-10'],
    ['2026-05', 'year', '2025-01'],
  ] as const)('the period before %s (%s) lies in %s', (month, period, expected) => {
    expect(periodOf(previousPeriodMonth(month, period), period).months).toContain(expected);
  });

  it('lists the last periods oldest first, ending with the current one', () => {
    expect(pastPeriodMonths('2026-02', 'month', 3)).toEqual(['2025-12', '2026-01', '2026-02']);
    expect(pastPeriodMonths('2026-05', 'quarter', 3)).toEqual(['2025-10', '2026-01', '2026-04']);
    expect(pastPeriodMonths('2026-05', 'year', 2)).toEqual(['2025-01', '2026-01']);
  });

  it.each([
    ['2026-03-10', 'month', 31, 10, true],
    ['2026-03-31', 'month', 31, 31, true],
    ['2026-04-01', 'month', 31, 31, false],
    ['2026-02-01', 'month', 31, 0, false],
    ['2026-02-14', 'quarter', 90, 45, true],
    ['2028-12-31', 'year', 366, 366, true],
  ] as const)(
    'today %s in the %s of March/Q1/2028: total %i, gone %i, running %s',
    (today, kind, total, elapsed, running) => {
      const info =
        kind === 'month'
          ? periodOf('2026-03', 'month')
          : kind === 'quarter'
            ? periodOf('2026-01', 'quarter')
            : periodOf('2028-06', 'year');
      const e = elapsedIn(info, today);
      expect(e.total).toBe(kind === 'quarter' ? 90 : total);
      expect(e.elapsed).toBe(kind === 'quarter' && today === '2026-02-14' ? 45 : elapsed);
      expect(e.running).toBe(running);
    },
  );
});

describe('spending of a category family', () => {
  const cats = [
    { id: 'food' },
    { id: 'super', parentId: 'food' },
    { id: 'market', parentId: 'food' },
    { id: 'home' },
  ];
  const m = (o: Record<string, number>) => new Map(Object.entries(o));
  it('includes children and sums the months of a period', () => {
    const months = [
      m({ food: 100, super: 200, home: 999 }),
      m({ market: 50 }),
      undefined,
      m({ super: 1 }),
    ];
    expect(spentInMonths(months, cats, 'food')).toBe(351);
    expect(spentInMonths(months, cats, 'home')).toBe(999);
    expect(spentInMonths(months, cats, 'super')).toBe(201); // a child budget counts only itself
    expect(spentInMonths([], cats, 'food')).toBe(0);
  });
  it('knows the family', () => {
    expect([...familyOf(cats, 'food')].sort()).toEqual(['food', 'market', 'super']);
    expect([...familyOf(cats, 'gone')]).toEqual(['gone']);
  });
});

describe('carry-over (expectation table)', () => {
  const rows: [number, number, number, number][] = [
    // limit, spent last period, carry in, effective limit
    [30000, 22000, 8000, 38000],
    [30000, 30000, 0, 30000],
    [30000, 35000, -5000, 25000],
    [30000, 0, 30000, 60000], // never more than one limit
    [30000, 90000, -30000, 0], // never below zero
    [30000, 70000, -30000, 0],
  ];
  it.each(rows)('limit %i, spent %i → carry %i, limit now %i', (limit, spent, carry, now) => {
    expect(carryIn(limit, spent)).toBe(carry);
    expect(effectiveLimit(limit, carry)).toBe(now);
  });
  it('without carry-over the limit is the limit', () => expect(effectiveLimit(500)).toBe(500));
});

describe('status against a threshold (expectation table)', () => {
  const rows: [number, number, number | undefined, string, number][] = [
    // limit, spent, warnAt, tone, pct
    [10000, 7999, undefined, 'ok', 80], // 79.99 % rounds to 80 but is not yet 80 %
    [10000, 8000, undefined, 'warn', 80],
    [10000, 10000, undefined, 'warn', 100], // exactly the limit is not over
    [10000, 10001, undefined, 'over', 100],
    [10000, 5000, 50, 'warn', 50],
    [10000, 4999, 50, 'ok', 50],
    [10000, 9500, 95, 'warn', 95],
    [0, 0, undefined, 'ok', 0],
    [0, 100, undefined, 'over', 100],
  ];
  it.each(rows)('limit %i spent %i warnAt %s → %s', (limit, spent, warnAt, tone, pct) => {
    const s = budgetStatus(limit, spent, warnAt);
    expect(s.tone).toBe(tone);
    expect(s.pct).toBe(pct);
    expect(s.remaining).toBe(limit - spent);
  });
});

describe('forecast to the end of the period (expectation table)', () => {
  const rows: [string, number, number, number, number, number][] = [
    // name, spent, planned, elapsed, total, expected
    ['before the period: only the planned', 0, 800, 0, 30, 800],
    ['day 1 with nothing spent: the planned', 0, 800, 1, 30, 800],
    ['run rate wins', 15000, 5000, 15, 30, 30000],
    ['spent plus planned wins (rent not yet booked)', 10000, 40000, 10, 30, 50000],
    ['last day: what it spent', 12345, 999, 30, 30, 12345],
    ['past the period', 12345, 0, 31, 30, 12345],
    ['rounding of the run rate (100/7*30)', 100, 0, 7, 30, 429],
  ];
  it.each(rows)('%s', (_n, spent, planned, elapsed, total, expected) => {
    expect(projectedSpend({ spent, planned, elapsed, total })).toBe(expected);
  });
});

describe('savings goals', () => {
  const goal = {
    targetMinor: 120000,
    deadline: '2026-12-31' as string | undefined,
    monthlyRateMinor: 10000 as number | undefined,
  };
  it('keeps the required rate for the deadline (rounded up)', () => {
    const p = goalProgress(
      { targetMinor: 120000, deadline: '2026-12-31' },
      [{ amountMinor: 20000 }],
      '2026-07-01',
    );
    expect(p.perMonth).toBe(Math.ceil(100000 / 7)); // 183 days = 7 started months
  });
  it.each([
    [
      'rate 100 €, 1.000 € saved: ten months',
      { ...goal },
      20000,
      '2026-03-01',
      10,
      '2027-01-01',
      0,
    ],
    [
      'reached in time',
      { ...goal, deadline: '2027-06-30' },
      20000,
      '2026-03-01',
      10,
      '2027-01-01',
      0,
    ],
    [
      'two months late',
      { ...goal, deadline: '2026-10-31' },
      20000,
      '2026-03-01',
      10,
      '2027-01-01',
      2,
    ],
    [
      'no deadline is never late',
      { ...goal, deadline: undefined },
      0,
      '2026-03-01',
      12,
      '2027-03-01',
      0,
    ],
    [
      'rounds the months up (100,01 €)',
      { ...goal, targetMinor: 100001, deadline: undefined },
      0,
      '2026-03-31',
      11,
      '2027-02-28',
      0,
    ],
  ] as const)('%s', (_n, g, saved, today, months, reachedOn, late) => {
    const plan = goalPlan(g, saved, today)!;
    expect(plan.months).toBe(months);
    expect(plan.reachedOn).toBe(reachedOn);
    expect(plan.monthsLate).toBe(late);
  });
  it('has no plan without a rate or once reached', () => {
    expect(goalPlan({ ...goal, monthlyRateMinor: undefined }, 0, '2026-03-01')).toBeUndefined();
    expect(goalPlan(goal, 120000, '2026-03-01')).toBeUndefined();
  });
});

describe('goal pace since the start (expectation table)', () => {
  it.each([
    ['three months', '2026-01-01', '2026-04-01', 30000, 10000],
    ['less than a month counts as one', '2026-03-01', '2026-03-10', 9000, 9000],
    ['start day itself', '2026-01-01', '2026-01-01', 5000, 5000],
    ['a full year', '2026-01-01', '2027-01-01', 120000, 10000],
    ['half a cent rounds up', '2026-01-01', '2026-03-01', 10001, 5001],
    ['leap year (366 days)', '2028-01-01', '2029-01-01', 120000, 10000],
  ] as const)('%s', (_n, startDate, today, saved, expected) => {
    expect(goalPace({ startDate }, saved, today)).toBe(expected);
  });
  it('has no pace without a start, in the future, or without savings', () => {
    expect(goalPace({}, 5000, '2026-04-01')).toBeUndefined();
    expect(goalPace({ startDate: '2026-05-01' }, 5000, '2026-04-01')).toBeUndefined();
    expect(goalPace({ startDate: '2026-01-01' }, 0, '2026-04-01')).toBeUndefined();
    expect(goalPace({ startDate: '2026-01-01' }, -500, '2026-04-01')).toBeUndefined();
  });
});

describe('month the target is reached at the pace so far (expectation table)', () => {
  it.each([
    ['nine more months', 120000, 30000, 10000, '2026-04-01', '2027-01-01'],
    ['rounds the last month up', 100000, 30000, 30000, '2026-04-01', '2026-07-01'],
    ['month end is kept', 50000, 20000, 10000, '2026-01-31', '2026-04-30'],
  ] as const)('%s', (_n, targetMinor, saved, pace, today, expected) => {
    expect(paceReachedOn({ targetMinor }, saved, pace, today)).toBe(expected);
  });
  it('has no date once reached or without a pace', () => {
    expect(paceReachedOn({ targetMinor: 1000 }, 1000, 500, '2026-04-01')).toBeUndefined();
    expect(paceReachedOn({ targetMinor: 1000 }, 0, 0, '2026-04-01')).toBeUndefined();
  });
});
