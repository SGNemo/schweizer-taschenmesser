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

/**
 * Is `plannedFor` the planner's own date? Only while the mark carries the same day; every other
 * combination (no mark, a mark for another day, a mixed field-level merge) reads as the user's date –
 * the safe direction, because sync merges each field on its own.
 */
export const isPlannerOwned = (task: Marked): boolean =>
  task.plannedFor !== undefined && task.planMark?.date === task.plannedFor;

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
 */
export function viewOf(task: V, day: string): TodoView {
  if (task.done) return 'done';
  if (task.someday) return 'someday';
  if (task.startDate && task.startDate > day) return 'soon';
  const when = [task.plannedFor, task.dueDate].filter((d): d is string => !!d);
  if (when.length === 0) return 'someday';
  return when.some((d) => d <= day) ? 'today' : 'soon';
}

export const inView = (task: V, view: TodoView, day: string): boolean => viewOf(task, day) === view;

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
