import { isPlannerOwned } from '@/core/modules/types';
import { addDaysStr } from '@/core/time/dates';
import { postponePatch } from './postpone';
import type { Task } from './schema';

/**
 * The four ways to look at the open work, shared by the list tabs and the board columns.
 * They are views, not stored states: only `someday` is a flag, the rest follows the dates.
 */
export const TODO_VIEWS = ['today', 'soon', 'someday', 'done'] as const;
export type TodoView = (typeof TODO_VIEWS)[number];

type V = Pick<Task, 'done' | 'someday' | 'dueDate' | 'plannedFor' | 'startDate' | 'planMark'>;

type Marked = Pick<Task, 'plannedFor' | 'planMark'>;

export { isPlannerOwned };

export type PlannedForPatch = Partial<Pick<Task, 'plannedFor' | 'planMark'>>;

/**
 * The one way the ToDo side writes `plannedFor` (editor, inbox sorter, wrap-up, „Für heute“, „Später“,
 * board move, create on Heute): the planner's mark is cleared only when the date really changes, so a
 * title-only save keeps it and the planner keeps its ownership. Returns an empty patch when nothing changes.
 */
export function userPlannedFor(task: Marked, date: string | undefined): PlannedForPatch {
  if (task.plannedFor === date) return {};
  return { plannedFor: date, ...(task.planMark ? { planMark: undefined } : {}) };
}

/**
 * - `done`: ticked off.
 * - `someday`: kept back on purpose, or without any date.
 * - `today`: due or planned for today or earlier (and not hidden by a later start date).
 * - `soon`: dated for a later day, or not started yet.
 *
 * `planner`: the planner module is on. A day it gave the thing (its own mark, `isPlannerOwned`) wins over an older
 * due date – the thing is „soon“ until that day, so the ToDo page counts what the plan counts (N02, CONCEPT §7).
 * A user's date, or a thing the planner has not placed, keeps the plain rule.
 */
export function viewOf(task: V, day: string, planner = false): TodoView {
  if (task.done) return 'done';
  if (task.someday) return 'someday';
  if (task.startDate && task.startDate > day) return 'soon';
  if (planner && isLaterInPlan(task, day)) return 'soon';
  const when = [task.plannedFor, task.dueDate].filter((d): d is string => !!d);
  if (when.length === 0) return 'someday';
  return when.some((d) => d <= day) ? 'today' : 'soon';
}

/** The planner put the thing on a later day (its own mark matches the date). */
export const isLaterInPlan = (task: Marked, day: string): boolean =>
  isPlannerOwned(task) && task.plannedFor! > day;

export const inView = (task: V, view: TodoView, day: string, planner = false): boolean =>
  viewOf(task, day, planner) === view;

export type MovePatch = Partial<
  Pick<
    Task,
    'someday' | 'plannedFor' | 'planMark' | 'dueDate' | 'done' | 'completedAt' | 'startDate'
  >
>;

/**
 * The change that moves a task into a board column. "Erledigt" is not here: ticking off goes
 * through `setDone` (it creates the next instance of a repeating task).
 */
export function movePatch(task: V, to: Exclude<TodoView, 'done'>, day: string): MovePatch {
  const open = { done: false, completedAt: undefined };
  if (to === 'someday')
    return { ...open, someday: true, plannedFor: undefined, ...userPlannedFor(task, undefined) };
  const tomorrow = addDaysStr(day, 1);
  if (to === 'today')
    return {
      ...open,
      someday: undefined,
      plannedFor: day,
      ...userPlannedFor(task, day),
      // A start date in the future would hide it again.
      ...(task.startDate && task.startDate > day ? { startDate: day } : {}),
    };
  // "soon": the same calm rule as "Später" – tomorrow, never an old or guilt-laden date.
  const target = task.plannedFor && task.plannedFor > tomorrow ? task.plannedFor : tomorrow;
  return {
    ...open,
    someday: undefined,
    ...postponePatch(task, day),
    plannedFor: target,
    ...userPlannedFor(task, target),
  };
}

/** Overdue open tasks (due before `day`, not hidden, not someday), for "Alle auf heute". */
export function overdueTasks<X extends V & { id: string; parentId?: string }>(
  tasks: readonly X[],
  day: string,
): X[] {
  return tasks.filter(
    (x) => !x.done && !x.someday && !x.parentId && !!x.dueDate && x.dueDate < day,
  );
}
