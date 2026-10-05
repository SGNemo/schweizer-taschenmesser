import { describe, expect, it } from 'vitest';
import { groupByStatus, groupByTime, timeGroupOf } from './groups';

const TODAY = '2026-09-29'; // Tuesday

describe('timeGroupOf', () => {
  it('buckets by distance from today', () => {
    expect(timeGroupOf(undefined, TODAY)).toBe('none');
    expect(timeGroupOf('2026-09-28', TODAY)).toBe('overdue');
    expect(timeGroupOf(TODAY, TODAY)).toBe('today');
    expect(timeGroupOf('2026-09-30', TODAY)).toBe('tomorrow');
    expect(timeGroupOf('2026-10-02', TODAY)).toBe('week'); // Friday of the same week
    expect(timeGroupOf('2026-10-04', TODAY)).toBe('week'); // Sunday
    expect(timeGroupOf('2026-10-05', TODAY)).toBe('later'); // next Monday
  });
  it('finished items are never overdue', () => {
    expect(timeGroupOf('2026-09-20', TODAY, { done: true })).toBe('later');
  });
  it('respects Sunday-first weeks', () => {
    expect(timeGroupOf('2026-10-04', TODAY, { weekStart: 7 })).toBe('later');
    expect(timeGroupOf('2026-10-03', TODAY, { weekStart: 7 })).toBe('week');
  });
});

describe('groupByTime', () => {
  it('orders groups, omits empty ones and keeps the order inside a group', () => {
    const items = [
      { id: 'a', d: '2026-10-20' },
      { id: 'b', d: '2026-09-01' },
      { id: 'c', d: TODAY },
      { id: 'd', d: '2026-09-02' },
      { id: 'e', d: undefined },
    ];
    const g = groupByTime(items, (i) => i.d, TODAY);
    expect(g.map((x) => x.id)).toEqual(['overdue', 'today', 'later', 'none']);
    expect(g[0]!.items.map((i) => i.id)).toEqual(['b', 'd']);
  });
});

describe('groupByStatus', () => {
  it('follows the given order and appends unknown statuses', () => {
    const g = groupByStatus(
      [{ s: 'paid' }, { s: 'open' }, { s: 'weird' }, { s: 'open' }],
      (i) => i.s,
      ['open', 'paid'],
    );
    expect(g.map((x) => [x.id, x.items.length])).toEqual([
      ['open', 2],
      ['paid', 1],
      ['weird', 1],
    ]);
  });
});
