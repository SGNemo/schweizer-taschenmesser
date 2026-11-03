import { addDaysStr, isoWeekday, startOfWeekStr } from '@/core/time/dates';
import type { Entry, Goal } from './schema';

type G = Pick<Goal, 'kind' | 'target' | 'period'> & {
  weekdays?: readonly number[];
  weeklyTimes?: number;
};
type E = Pick<Entry, 'goalId' | 'date' | 'count' | 'skipped'>;

/** Entries of one goal by day. */
export function byDate(entries: readonly E[], goalId: string): Map<string, E> {
  const map = new Map<string, E>();
  for (const e of entries) if (e.goalId === goalId) map.set(e.date, e);
  return map;
}

/** Is the goal planned on `date`? "x times a week" goals count on any day. */
export function isScheduled(goal: G, date: string): boolean {
  if (goal.period === 'week') return true;
  const days = goal.weekdays;
  return !days || days.length === 0 || days.includes(isoWeekday(date));
}

/** What the goal asks of one day (1 for yes/no). */
export const dailyTarget = (goal: G): number => (goal.kind === 'count' ? goal.target : 1);

export type DayState = 'done' | 'partial' | 'open' | 'rest' | 'off';

/**
 * State of one day:
 * `off` not planned · `rest` a rest day (never counts against) · `done` target reached ·
 * `partial` something done · `open` nothing yet.
 */
export function dayState(goal: G, entry: E | undefined, date: string): DayState {
  if (entry?.skipped && (entry.count ?? 0) === 0) return 'rest';
  const count = entry?.count ?? 0;
  if (count >= dailyTarget(goal)) return 'done';
  if (!isScheduled(goal, date)) return count > 0 ? 'partial' : 'off';
  return count > 0 ? 'partial' : 'open';
}

/** 0..1 progress of the day (capped), for the ring. */
export function dayProgress(goal: G, entry: E | undefined): number {
  const target = dailyTarget(goal);
  return Math.min(1, (entry?.count ?? 0) / target);
}

/** Times done in the week of `date` against the weekly goal. */
export function weekDone(
  goal: G,
  map: ReadonlyMap<string, E>,
  date: string,
  weekStart: 1 | 7 = 1,
): { done: number; of: number } {
  const first = startOfWeekStr(date, weekStart);
  let done = 0;
  let planned = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDaysStr(first, i);
    const state = dayState(goal, map.get(d), d);
    if (state === 'done') done += 1;
    if (state !== 'off' && state !== 'rest') planned += 1;
  }
  return { done, of: goal.period === 'week' ? (goal.weeklyTimes ?? 3) : Math.max(planned, done) };
}

/**
 * Share of planned days that were done in [from, to]. Rest days and days that are not planned do
 * not count at all: a pause never lowers the number. `null` when no day counts.
 */
export function rate(
  goal: G,
  map: ReadonlyMap<string, E>,
  from: string,
  to: string,
): { done: number; of: number } | null {
  let done = 0;
  let of = 0;
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    const state = dayState(goal, map.get(d), d);
    if (state === 'off' || state === 'rest') continue;
    of += 1;
    if (state === 'done') done += 1;
  }
  // A weekly goal is judged by the week, not by single days.
  if (goal.period === 'week') {
    let weeks = 0;
    let met = 0;
    for (let d = startOfWeekStr(from, 1); d <= to; d = addDaysStr(d, 7)) {
      weeks += 1;
      if (weekDone(goal, map, d, 1).done >= (goal.weeklyTimes ?? 3)) met += 1;
    }
    return weeks === 0 ? null : { done: met, of: weeks };
  }
  return of === 0 ? null : { done, of };
}

/** Share done per ISO weekday (1–7) over [from, to]; `null` for a weekday that never counted. */
export function perWeekday(
  goal: G,
  map: ReadonlyMap<string, E>,
  from: string,
  to: string,
): (number | null)[] {
  const done = Array<number>(8).fill(0);
  const of = Array<number>(8).fill(0);
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    const state = dayState(goal, map.get(d), d);
    if (state === 'off' || state === 'rest') continue;
    const wd = isoWeekday(d);
    of[wd] = (of[wd] ?? 0) + 1;
    if (state === 'done') done[wd] = (done[wd] ?? 0) + 1;
  }
  return [1, 2, 3, 4, 5, 6, 7].map((wd) => (of[wd] ? (done[wd] ?? 0) / of[wd]! : null));
}

/**
 * Longest run of done days ending anywhere in [from, to]. Rest days and unplanned days neither
 * extend nor break a run, so a pause never costs anything. Shown only when the streak setting is on.
 */
export function longestRun(goal: G, map: ReadonlyMap<string, E>, from: string, to: string): number {
  let best = 0;
  let run = 0;
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    const state = dayState(goal, map.get(d), d);
    if (state === 'off' || state === 'rest') continue;
    if (state === 'done') {
      run += 1;
      best = Math.max(best, run);
    } else if (d < to) run = 0; // today, still open, does not break anything
  }
  return best;
}

export interface HeatCell {
  date: string;
  state: DayState;
  count: number;
}

/** Weeks (columns of 7 days, `weekStart` first) ending with the week of `end`, for the year grid. */
export function heatmap(
  goal: G,
  map: ReadonlyMap<string, E>,
  end: string,
  weeks = 53,
  weekStart: 1 | 7 = 1,
): HeatCell[][] {
  const lastWeek = startOfWeekStr(end, weekStart);
  const firstWeek = addDaysStr(lastWeek, -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => {
      const date = addDaysStr(firstWeek, w * 7 + i);
      const entry = map.get(date);
      return { date, state: dayState(goal, entry, date), count: entry?.count ?? 0 };
    }),
  );
}
