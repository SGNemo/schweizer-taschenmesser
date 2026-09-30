import { addDaysStr, isoWeekday } from '@/core/time/dates';
import type { Habit } from './schema';

type H = Pick<Habit, 'weekdays'>;

export const checkId = (habitId: string, date: string): string => `${habitId}:${date}`;

export const isScheduled = (h: H, date: string): boolean => h.weekdays.includes(isoWeekday(date));

const MAX_LOOKBACK = 3650;

/**
 * Consecutive scheduled days done, counted back from today. Days the habit is not scheduled on are
 * skipped; today does not break the streak while it is still open.
 */
export function streak(h: H, done: ReadonlySet<string>, today: string): number {
  let count = 0;
  let day = today;
  for (let i = 0; i < MAX_LOOKBACK; i++, day = addDaysStr(day, -1)) {
    if (!isScheduled(h, day)) continue;
    if (done.has(day)) count += 1;
    else if (day !== today) break;
  }
  return count;
}

export interface DayCell {
  date: string;
  scheduled: boolean;
  done: boolean;
}

/** The last `days` days ending today, oldest first. */
export function recentDays(h: H, done: ReadonlySet<string>, today: string, days = 7): DayCell[] {
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysStr(today, i - (days - 1));
    return { date, scheduled: isScheduled(h, date), done: done.has(date) };
  });
}

/** Share of scheduled days done within the last `days` days (0–100), or undefined without a schedule. */
export function completionRate(
  h: H,
  done: ReadonlySet<string>,
  today: string,
  days = 30,
): number | undefined {
  const cells = recentDays(h, done, today, days).filter((c) => c.scheduled);
  if (cells.length === 0) return undefined;
  return Math.round((cells.filter((c) => c.done).length / cells.length) * 100);
}

/** Groups check dates per habit. */
export function doneByHabit(
  checks: readonly { habitId: string; date: string }[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const c of checks) {
    if (!map.has(c.habitId)) map.set(c.habitId, new Set());
    map.get(c.habitId)!.add(c.date);
  }
  return map;
}
