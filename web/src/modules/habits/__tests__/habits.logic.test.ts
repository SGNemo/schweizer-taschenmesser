import { describe, expect, it } from 'vitest';
import { addDaysStr } from '@/core/time/dates';
import {
  byDate,
  dayProgress,
  dayState,
  heatmap,
  isScheduled,
  longestRun,
  perWeekday,
  rate,
  weekDone,
} from '../logic';

const water = { kind: 'count', target: 8, period: 'day' } as const;
const walk = { kind: 'yesno', target: 1, period: 'day', weekdays: [1, 2, 3, 4, 5] } as const;
const stretch = { kind: 'yesno', target: 1, period: 'week', weeklyTimes: 3 } as const;
const e = (goalId: string, date: string, count: number, skipped?: boolean) => ({
  goalId,
  date,
  count,
  ...(skipped ? { skipped } : {}),
});

describe('day state', () => {
  it('reads the count against the target', () => {
    expect(dayState(water, e('w', '2026-11-03', 8), '2026-11-03')).toBe('done');
    expect(dayState(water, e('w', '2026-11-03', 3), '2026-11-03')).toBe('partial');
    expect(dayState(water, undefined, '2026-11-03')).toBe('open');
    expect(dayProgress(water, e('w', '2026-11-03', 4))).toBe(0.5);
    expect(dayProgress(water, e('w', '2026-11-03', 20))).toBe(1);
  });
  it('knows rest days and unplanned days', () => {
    expect(dayState(water, e('w', '2026-11-03', 0, true), '2026-11-03')).toBe('rest');
    // 2026-11-01 is a Sunday: not planned for the weekday goal
    expect(isScheduled(walk, '2026-11-01')).toBe(false);
    expect(dayState(walk, undefined, '2026-11-01')).toBe('off');
    expect(dayState(walk, e('x', '2026-11-01', 1), '2026-11-01')).toBe('done');
  });
});

describe('rates never punish a pause', () => {
  const map = byDate(
    [
      e('w', '2026-11-02', 8),
      e('w', '2026-11-03', 2),
      e('w', '2026-11-04', 0, true), // rest
      e('w', '2026-11-05', 8),
    ],
    'w',
  );
  it('leaves rest days out of the denominator', () => {
    expect(rate(water, map, '2026-11-02', '2026-11-05')).toEqual({ done: 2, of: 3 });
  });
  it('is null when nothing counts', () => {
    expect(rate(walk, new Map(), '2026-11-01', '2026-11-01')).toBeNull();
  });
  it('gives the share per weekday', () => {
    const per = perWeekday(water, map, '2026-11-02', '2026-11-05');
    expect(per[0]).toBe(1); // Monday done
    expect(per[1]).toBe(0); // Tuesday partial
    expect(per[2]).toBeNull(); // Wednesday was a rest day
    expect(per[3]).toBe(1);
    expect(per[6]).toBeNull();
  });
});

describe('the last 30 days while today is still open', () => {
  const day = '2026-11-02'; // Monday morning, nothing logged yet today
  const daily = { kind: 'yesno', target: 1, period: 'day' } as const;
  it('a daily goal done on each of the 29 days before is 100 %', () => {
    const map = byDate(
      Array.from({ length: 29 }, (_, i) => e('g', addDaysStr(day, -(i + 1)), 1)),
      'g',
    );
    expect(rate(daily, map, addDaysStr(day, -29), day)).toEqual({
      done: 29,
      of: 29,
    });
    // Done today, it counts.
    map.set(day, e('g', day, 1));
    expect(rate(daily, map, addDaysStr(day, -29), day)).toEqual({
      done: 30,
      of: 30,
    });
  });
  it('a weekly goal met in every past week is 100 %; the running week counts once met', () => {
    const entries = [];
    for (let w = 1; w <= 6; w++)
      for (let i = 0; i < 3; i++) entries.push(e('g', addDaysStr(day, -7 * w + i), 1));
    const map = byDate(entries, 'g');
    expect(rate(stretch, map, addDaysStr(day, -29), day)).toEqual({ done: 5, of: 5 });
    for (let i = 0; i < 3; i++) map.set(addDaysStr(day, i), e('g', addDaysStr(day, i), 1));
    expect(rate(stretch, map, addDaysStr(day, -29), addDaysStr(day, 2))).toEqual({
      done: 6,
      of: 6,
    });
  });
});

describe('weekly goals', () => {
  const map = byDate(
    [e('s', '2026-11-02', 1), e('s', '2026-11-04', 1), e('s', '2026-11-10', 1)],
    's',
  );
  it('counts times in the week against the weekly target', () => {
    expect(weekDone(stretch, map, '2026-11-03')).toEqual({ done: 2, of: 3 });
    expect(weekDone(stretch, map, '2026-11-10')).toEqual({ done: 1, of: 3 });
  });
  it('judges the rate by the week', () => {
    expect(rate(stretch, map, '2026-11-02', '2026-11-16')).toEqual({ done: 0, of: 2 });
    // On Sunday 15 Nov (today) the second week is still running: it does not count yet.
    expect(rate(stretch, map, '2026-11-02', '2026-11-15')).toEqual({ done: 0, of: 1 });
  });
});

describe('runs and heatmap', () => {
  it('skips rest days and unplanned days without breaking the run', () => {
    const map = byDate(
      [
        e('w', '2026-11-02', 8),
        e('w', '2026-11-03', 8),
        e('w', '2026-11-04', 0, true),
        e('w', '2026-11-05', 8),
      ],
      'w',
    );
    expect(longestRun(water, map, '2026-11-02', '2026-11-05')).toBe(3);
  });
  it('lets an open today stand without breaking the run', () => {
    const map = byDate([e('w', '2026-11-02', 8), e('w', '2026-11-03', 8)], 'w');
    expect(longestRun(water, map, '2026-11-02', '2026-11-04')).toBe(2);
  });
  it('builds 53 weeks of seven days ending with this week', () => {
    const grid = heatmap(water, new Map(), '2026-11-04');
    expect(grid).toHaveLength(53);
    expect(grid[0]).toHaveLength(7);
    expect(grid[52]![0]!.date).toBe('2026-11-02');
    expect(grid[52]![2]!.date).toBe('2026-11-04');
  });
});
