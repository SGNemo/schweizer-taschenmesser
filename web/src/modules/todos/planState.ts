/**
 * Where a ToDo stands in the plan, read from its own fields (todos-plan-state): `plannedFor` + `planMark` are the
 * planner's only while they agree (`isPlannerOwned`), so a mark and a date mixed by field LWW from two devices read as
 * „noch nicht im Plan“ – the safe direction (nothing claims a day the planner may not have). „fest“ and „Nicht planen“
 * live in the planner; they come in as `facts` (`core/entitylinks/planRow.ts planFacts`).
 *
 * Only what the planner lists can carry a mark (`plannable.ts`): an open top-level task that is not „Irgendwann“.
 * A subtask has none – it is done as part of its main task, which is the thing on the day.
 */
import type { PlanFacts } from '@/core/entitylinks/planRow';
import { addDaysStr } from '@/core/time/dates';
import { isPlannerOwned } from './views';
import type { Task } from './schema';

export type PlanState =
  /** No mark: done, „Irgendwann“, a subtask, or the planner is off. */
  | { kind: 'none' }
  /** Listed by the planner, no day of its own there. */
  | { kind: 'unplanned' }
  /** „Nicht planen“ in the planner. */
  | { kind: 'excluded' }
  /** On a day from today on. */
  | { kind: 'planned'; date: string; locked: boolean }
  /** On a day that has passed (the planner's tab „Noch offen“). */
  | { kind: 'passed'; date: string; locked: boolean };

type T = Pick<Task, 'done' | 'someday' | 'parentId' | 'plannedFor' | 'planMark'>;

export function planStateOf(task: T, day: string, facts?: PlanFacts): PlanState {
  if (task.done || task.someday || task.parentId) return { kind: 'none' };
  if (facts?.excluded) return { kind: 'excluded' };
  if (!isPlannerOwned(task)) return { kind: 'unplanned' };
  const date = task.plannedFor!;
  const locked = facts?.locked === true;
  return date < day ? { kind: 'passed', date, locked } : { kind: 'planned', date, locked };
}

/** The filter above the list; stored per device. */
export const PLAN_FILTERS = ['all', 'unplanned', 'planned'] as const;
export type PlanFilter = (typeof PLAN_FILTERS)[number];

/** Does a top-level task pass the filter (a passed day is in the plan: it waits in „Noch offen“). */
export function passesPlanFilter(state: PlanState, filter: PlanFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'unplanned') return state.kind === 'unplanned';
  return state.kind === 'planned' || state.kind === 'passed';
}

const FILTER_KEY = 'todos.planFilter';

export function readPlanFilter(): PlanFilter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return (PLAN_FILTERS as readonly string[]).includes(v ?? '') ? (v as PlanFilter) : 'all';
  } catch {
    return 'all';
  }
}

export function writePlanFilter(filter: PlanFilter): void {
  try {
    if (filter === 'all') localStorage.removeItem(FILTER_KEY);
    else localStorage.setItem(FILTER_KEY, filter);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
}

/** How far a day is named by its weekday alone („Mi“); later ones carry the date („Mi 2.12.“). */
export const WEEKDAY_SPAN = 6;

export type DayWord = { kind: 'today' } | { kind: 'weekday' } | { kind: 'dated' };

/** Which form names a planned day: „heute“, the weekday in the coming week, else weekday + date. */
export function dayWordOf(date: string, day: string): DayWord {
  if (date === day) return { kind: 'today' };
  if (date > day && date <= addDaysStr(day, WEEKDAY_SPAN)) return { kind: 'weekday' };
  if (date < day && date >= addDaysStr(day, -WEEKDAY_SPAN)) return { kind: 'weekday' };
  return { kind: 'dated' };
}

/** Where a tap on the mark leads: the planner on that day with the row in view, or its tab „Noch offen“. */
export function plannerPath(state: PlanState, taskId: string): string | undefined {
  const item = encodeURIComponent(`todos:${taskId}`);
  if (state.kind === 'planned') return `/planner?day=${state.date}&item=${item}`;
  if (state.kind === 'passed') return `/planner?tab=open&item=${item}`;
  return undefined;
}
