/**
 * "Nächste eine Sache", the day plan and "Neu planen": pure selection logic on top of the ToDos.
 * Calm by design: one suggestion, the user's own plan first, nothing punishes an old date.
 * Rules: docs/design/FOCUS-GUIDELINES.md.
 */
import { addDaysStr, daysBetween } from '@/core/time/dates';
import { toDateString } from '@/core/time/now';
import { compareTasks } from './logic';
import type { Task } from './schema';

export type PickTask = Pick<
  Task,
  'done' | 'dueDate' | 'plannedFor' | 'priority' | 'order' | 'estimateMin' | 'someday' | 'parentId'
> & { id: string; createdAt: number; completedAt?: number };

/** Effort assumed for a task without an estimate when comparing "quick wins". */
const DEFAULT_ESTIMATE_MIN = 30;
const SOON_DAYS = 3;

const isOpenTop = (t: PickTask): boolean => !t.done && !t.someday && !t.parentId;

/**
 * 0 planned for today (or an earlier day) · 1 due today · 2 due soon · 3 overdue · 4 anything else.
 * Overdue comes after "soon": an old date must not drown what fits the day.
 */
export function nextTier(t: PickTask, today: string): number {
  if (t.plannedFor && t.plannedFor <= today) return 0;
  if (t.dueDate) {
    const d = daysBetween(today, t.dueDate);
    if (d === 0) return 1;
    if (d > 0 && d <= SOON_DAYS) return 2;
    if (d < 0) return 3;
  }
  return 4;
}

function compareNext(a: PickTask, b: PickTask, today: string): number {
  const ta = nextTier(a, today);
  const tb = nextTier(b, today);
  if (ta !== tb) return ta - tb;
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ea = a.estimateMin ?? DEFAULT_ESTIMATE_MIN;
  const eb = b.estimateMin ?? DEFAULT_ESTIMATE_MIN;
  if (ea !== eb) return ea - eb;
  return compareTasks(a, b);
}

/** The one task to suggest: open, not "Irgendwann", not a subtask, not skipped today. */
export function pickNext<T extends PickTask>(
  tasks: readonly T[],
  today: string,
  skipped: readonly string[] = [],
): T | undefined {
  return tasks
    .filter((t) => isOpenTop(t) && !skipped.includes(t.id))
    .sort((a, b) => compareNext(a, b, today))[0];
}

export interface DayPlan<T> {
  /** Open tasks planned for today, in the user's order, at most `limit`. */
  planned: T[];
  /** How many more are planned than shown. */
  hidden: number;
  /** Top-level tasks completed today. */
  doneToday: number;
  /** Room left in the plan. */
  free: number;
}

export function dayPlan<T extends PickTask>(
  tasks: readonly T[],
  today: string,
  limit: number,
): DayPlan<T> {
  const planned = tasks
    .filter((t) => isOpenTop(t) && t.plannedFor !== undefined && t.plannedFor <= today)
    .sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
  const doneToday = tasks.filter(
    (t) =>
      t.done &&
      !t.parentId &&
      t.completedAt !== undefined &&
      toDateString(new Date(t.completedAt)) === today,
  ).length;
  const shown = planned.slice(0, limit);
  return {
    planned: shown,
    hidden: planned.length - shown.length,
    doneToday,
    free: Math.max(0, limit - planned.length),
  };
}

/** Open tasks whose date passed (not "Irgendwann", not subtasks, not planned for later). */
export function waitingTasks<T extends PickTask>(tasks: readonly T[], today: string): T[] {
  return tasks.filter(
    (t) =>
      isOpenTop(t) &&
      t.dueDate !== undefined &&
      t.dueDate < today &&
      !(t.plannedFor && t.plannedFor >= today),
  );
}

/**
 * "Neu planen": spreads the waiting tasks over today and the next days, `perDay` per day, counting
 * what is already due on a day. Returns the new due dates; the order follows `compareTasks`
 * (priority first, then the older date). Pure: the caller writes the result (with undo).
 */
export function replan<T extends PickTask>(
  tasks: readonly T[],
  today: string,
  perDay = 3,
): { id: string; dueDate: string }[] {
  const waiting = waitingTasks(tasks, today).sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return compareTasks(a, b);
  });
  const load = new Map<string, number>();
  for (const t of tasks)
    if (isOpenTop(t) && t.dueDate && t.dueDate >= today)
      load.set(t.dueDate, (load.get(t.dueDate) ?? 0) + 1);
  const out: { id: string; dueDate: string }[] = [];
  let day = today;
  for (const t of waiting) {
    while ((load.get(day) ?? 0) >= perDay) day = addDaysStr(day, 1);
    out.push({ id: t.id, dueDate: day });
    load.set(day, (load.get(day) ?? 0) + 1);
  }
  return out;
}
