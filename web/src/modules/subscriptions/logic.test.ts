import { describe, expect, it } from 'vitest';
import {
  annualCost,
  cancelDeadlinesInRange,
  chargesInRange,
  changePercent,
  chargesPerYear,
  nextCancelDeadline,
  nextCharge,
  recentIncrease,
  recordPriceChange,
  sortSubscriptions,
  totals,
} from './logic';
import { subscriptionSchema } from './schema';

const sub = (over: Record<string, unknown> = {}) =>
  subscriptionSchema.parse({
    name: 'Streaming',
    amountMinor: 1299,
    startDate: '2026-01-15',
    recurrence: { freq: 'monthly' },
    ...over,
  });

describe('subscription costs', () => {
  it('normalises every frequency to charges per year', () => {
    expect(chargesPerYear({ freq: 'monthly', interval: 1 })).toBe(12);
    expect(chargesPerYear({ freq: 'monthly', interval: 3 })).toBe(4);
    expect(chargesPerYear({ freq: 'yearly', interval: 1 })).toBe(1);
    expect(chargesPerYear({ freq: 'yearly', interval: 2 })).toBe(0.5);
    expect(chargesPerYear({ freq: 'weekly', interval: 1 })).toBe(52);
    expect(chargesPerYear({ freq: 'weekly', interval: 2, byWeekday: [1, 4] })).toBe(52);
    expect(chargesPerYear({ freq: 'daily', interval: 1 })).toBe(365);
  });

  it('sums active subscriptions per month and per year', () => {
    const list = [
      sub({ amountMinor: 1299 }), // 155.88 / year
      sub({ amountMinor: 9900, recurrence: { freq: 'yearly' } }), // 99.00 / year
      sub({ amountMinor: 5000, recurrence: { freq: 'monthly', interval: 3 } }), // 200.00 / year
      sub({ amountMinor: 99999, active: false }), // ignored
    ];
    expect(annualCost(list[0]!)).toBeCloseTo(15588);
    expect(totals(list)).toEqual({ yearly: 45488, monthly: 3791 });
  });

  it('has zero totals without subscriptions', () => {
    expect(totals([])).toEqual({ monthly: 0, yearly: 0 });
  });
});

describe('charges and cancellation', () => {
  it('finds the next charge on or after a date', () => {
    expect(nextCharge(sub(), '2026-09-29')).toBe('2026-10-15');
    expect(nextCharge(sub(), '2026-10-15')).toBe('2026-10-15');
  });

  it('respects the end of the rule', () => {
    const ended = sub({ recurrence: { freq: 'monthly', count: 2 } });
    expect(nextCharge(ended, '2026-09-29')).toBeUndefined();
    expect(chargesInRange(ended, '2026-01-01', '2026-12-31')).toEqual(['2026-01-15', '2026-02-15']);
  });

  it('computes the next cancellation deadline (charge minus notice days)', () => {
    const s = sub({ cancelNoticeDays: 30 });
    // Today 29 Sep: the 15 Oct charge can no longer be avoided (deadline was 15 Sep) → next is 15 Nov.
    expect(nextCancelDeadline(s, '2026-09-29')).toEqual({
      deadline: '2026-10-16',
      charge: '2026-11-15',
    });
    // Exactly on the deadline day it is still possible.
    expect(nextCancelDeadline(s, '2026-10-16')).toEqual({
      deadline: '2026-10-16',
      charge: '2026-11-15',
    });
    expect(nextCancelDeadline(s, '2026-10-17')).toEqual({
      deadline: '2026-11-15',
      charge: '2026-12-15',
    });
    expect(nextCancelDeadline(sub(), '2026-09-29')).toBeUndefined();
  });

  it('lists deadlines that fall inside a date range', () => {
    const s = sub({
      cancelNoticeDays: 14,
      recurrence: { freq: 'yearly' },
      startDate: '2026-03-01',
    });
    expect(cancelDeadlinesInRange(s, '2027-02-01', '2027-02-28')).toEqual([
      { charge: '2027-03-01', deadline: '2027-02-15' },
    ]);
    expect(cancelDeadlinesInRange(s, '2027-03-01', '2027-03-31')).toEqual([]);
  });

  it('sorts active by next charge, inactive last', () => {
    const list = sortSubscriptions(
      [
        sub({ name: 'Later', startDate: '2026-10-25' }),
        sub({ name: 'Off', active: false, startDate: '2026-10-01' }),
        sub({ name: 'Soon', startDate: '2026-10-01' }),
      ],
      '2026-09-29',
    );
    expect(list.map((s) => s.name)).toEqual(['Soon', 'Later', 'Off']);
  });
});

describe('price history', () => {
  it('records a change with its date and ignores an unchanged price', () => {
    expect(recordPriceChange([], '2026-09-15', 999, 1299)).toEqual([
      { date: '2026-09-15', fromMinor: 999, toMinor: 1299 },
    ]);
    expect(recordPriceChange([], '2026-09-15', 999, 999)).toEqual([]);
  });
  it('keeps the last 20 changes', () => {
    let h: ReturnType<typeof recordPriceChange> = [];
    for (let i = 1; i <= 25; i++) h = recordPriceChange(h, '2026-01-01', 100 + i, 101 + i);
    expect(h).toHaveLength(20);
    expect(h[0]!.fromMinor).toBe(106);
  });
  it('computes the percent change, negative for a cut', () => {
    expect(changePercent({ fromMinor: 999, toMinor: 1299 })).toBe(30);
    expect(changePercent({ fromMinor: 1000, toMinor: 800 })).toBe(-20);
  });
  it('flags only a recent increase', () => {
    const h = [
      { date: '2026-02-01', fromMinor: 500, toMinor: 600 },
      { date: '2026-09-01', fromMinor: 600, toMinor: 550 },
    ];
    expect(recentIncrease(h, '2026-09-29')).toBeUndefined(); // the recent change was a cut
    expect(recentIncrease(h, '2026-03-01')?.toMinor).toBe(600);
    expect(recentIncrease(h, '2027-03-01')).toBeUndefined(); // too old
  });
});

describe('cancelled for a date (recurrence end)', () => {
  const cancelled = sub({ recurrence: { freq: 'monthly', until: '2026-10-15' } });
  it('has charges until the date and none after it', () => {
    expect(nextCharge(cancelled, '2026-10-01')).toBe('2026-10-15');
    expect(nextCharge(cancelled, '2026-10-16')).toBeUndefined();
  });
  it('counts in the totals until the last charge, then no more (with today)', () => {
    const plain = sub({ amountMinor: 1000 });
    expect(totals([cancelled, plain], '2026-10-01').yearly).toBe(
      annualCost(cancelled) + annualCost(plain),
    );
    expect(totals([cancelled, plain], '2026-10-16').yearly).toBe(annualCost(plain));
    // without `today` the old behaviour stays (callers that do not pass it)
    expect(totals([cancelled, plain]).yearly).toBe(annualCost(cancelled) + annualCost(plain));
  });
});
