/**
 * Visible progress without pressure: series of recurring ToDos ("n in Folge" with a rest day), a
 * positive look at the week and the evening wrap-up. Pure functions; wording lives in `strings.ts`.
 * Rules: docs/design/FOCUS-GUIDELINES.md (positive and optional, no loss drama).
 */
import { addDaysStr } from '@/core/time/dates';
import { toDateString } from '@/core/time/now';
import type { Task } from './schema';

export type ProgressTask = Pick<
  Task,
  'done' | 'dueDate' | 'plannedFor' | 'recurrence' | 'someday' | 'parentId' | 'title'
> & { id: string; createdAt: number; completedAt?: number };

/** All instances of a recurring task share the first id (`<first>:<date>` for the later ones). */
export const seriesKey = (id: string): string => id.split(':')[0]!;

export interface Streak {
  /** Instances done in a row. */
  streak: number;
  /** Pause days used: a missed instance that did not break the series. */
  rest: number;
}

/**
 * The series so far: done instances in a row, newest first. The open instance due today is not
 * missed yet; an older open one is bridged by a rest day (default one) instead of ending the series.
 * Finishing late still counts. Never negative: a broken series simply shows nothing.
 */
export function streakOf(
  instances: readonly Pick<ProgressTask, 'done' | 'dueDate'>[],
  today: string,
  allowedRest = 1,
): Streak {
  const past = instances
    .filter((i) => i.dueDate !== undefined && i.dueDate <= today)
    .sort((a, b) => (a.dueDate! < b.dueDate! ? 1 : -1));
  let streak = 0;
  let rest = 0;
  for (const [i, inst] of past.entries()) {
    if (inst.done) streak++;
    else if (i === 0 && inst.dueDate === today) continue;
    else if (rest < allowedRest) rest++;
    else break;
  }
  return { streak, rest: streak > 0 ? rest : 0 };
}

/** Streak per series, for series with at least `min` done instances in a row. */
export function streaksOf(
  tasks: readonly ProgressTask[],
  today: string,
  opts: { allowedRest?: number; min?: number } = {},
): Map<string, Streak & { title: string }> {
  const groups = new Map<string, ProgressTask[]>();
  for (const t of tasks)
    if (t.recurrence && t.dueDate && !t.parentId)
      groups.set(seriesKey(t.id), [...(groups.get(seriesKey(t.id)) ?? []), t]);
  const out = new Map<string, Streak & { title: string }>();
  for (const [key, list] of groups) {
    const s = streakOf(list, today, opts.allowedRest ?? 1);
    if (s.streak >= (opts.min ?? 2)) {
      const newest = [...list].sort((a, b) => (a.dueDate! < b.dueDate! ? 1 : -1))[0]!;
      out.set(key, { ...s, title: newest.title });
    }
  }
  return out;
}

export type WeekTone = 'more' | 'same' | 'less' | 'none';

export interface WeekReview {
  doneThisWeek: number;
  donePrevWeek: number;
  /** Always friendly: "less" and "none" are phrased as a calm week, never as a shortfall. */
  tone: WeekTone;
  /** The day of the last seven with the most done, when it was at least two. */
  bestDay?: { date: string; count: number };
}

const doneOn = (t: ProgressTask): string | undefined =>
  t.done && !t.parentId && t.completedAt !== undefined
    ? toDateString(new Date(t.completedAt))
    : undefined;

/** The last seven days (today included) against the seven before. */
export function weekReview(tasks: readonly ProgressTask[], today: string): WeekReview {
  const from = addDaysStr(today, -6);
  const prevFrom = addDaysStr(today, -13);
  const prevTo = addDaysStr(today, -7);
  const perDay = new Map<string, number>();
  let prev = 0;
  for (const t of tasks) {
    const d = doneOn(t);
    if (!d) continue;
    if (d >= from && d <= today) perDay.set(d, (perDay.get(d) ?? 0) + 1);
    else if (d >= prevFrom && d <= prevTo) prev++;
  }
  const doneThisWeek = [...perDay.values()].reduce((a, b) => a + b, 0);
  const best = [...perDay.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? 1 : -1))[0];
  return {
    doneThisWeek,
    donePrevWeek: prev,
    tone:
      doneThisWeek === 0
        ? 'none'
        : doneThisWeek > prev
          ? 'more'
          : doneThisWeek === prev
            ? 'same'
            : 'less',
    ...(best && best[1] >= 2 ? { bestDay: { date: best[0], count: best[1] } } : {}),
  };
}

/** What is left of today's plan: open top-level tasks planned for today (or earlier). */
export function leftToday(tasks: readonly ProgressTask[], today: string): ProgressTask[] {
  return tasks.filter(
    (t) =>
      !t.done && !t.someday && !t.parentId && t.plannedFor !== undefined && t.plannedFor <= today,
  );
}

/** Evenings start at this hour (local). */
export const EVENING_HOUR = 17;
