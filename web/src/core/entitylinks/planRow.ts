/**
 * The generic row action „In den Plan“ of a thing that is a plan item itself – a list, an invoice
 * (docs/design/planner-hub/CONCEPT-SOURCES.md §3.3). It lives here, not under `core/plan/**`, which stays free of
 * database and registry imports.
 *
 *  - Shown only while the planner module is on: the bus has no reply, so the helper reads the module state itself.
 *  - Not placed yet: the entry emits `plan.requested` with `ref`. The planner writes its own item row for
 *    `<module>:<id>` and creates no ToDo; for a thing without a date that row is what switches it on as a source.
 *  - Placed: the entry reads „Im Plan · Di“ (`plannedDay`) and opens the planner on that day.
 *
 * The wording comes from the caller (its module's own strings), so every module names the action in its block.
 */
import { bus } from '@/core/events';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { useSharedLiveQuery } from '@/core/modules/sharedQuery';
import { dayName } from '@/core/plan/explain';
import type { TaschenmesserDB } from '@/core/db/db';
import { plannedDay } from './index';
import { NEVER_LINKED, refKey, type EntityRef } from './types';

const PLANNER = 'planner';

/** What the row asks into the plan: the thing itself plus what `plan.requested` carries. */
export interface PlanRowTarget {
  ref: EntityRef;
  /** The thing's name, for the planner's toast while its source has no title for it. */
  title: string;
  /** 'YYYY-MM-DD' the thing must be done by; kept by the planner as a hard deadline. */
  due?: string;
}

export interface PlanRowLabels {
  /** „In den Plan“ */
  add: string;
  /** „Im Plan · Di“ */
  placed: (day: string) => string;
}

/** Is the planner on, and on which day does the thing stand. */
export interface PlanRowState {
  on: boolean;
  /** 'YYYY-MM-DD' of its earliest day from today on; missing while it is not placed. */
  day?: string;
}

/** A row-menu entry (the shape of `RowMenuItem` in `@/ui`). */
export interface PlanRowEntry {
  id: string;
  label: string;
  onSelect: () => void;
}

/** The planner's state for one thing. `on` is false while the module is off, not in this build or not on this platform. */
export async function planRowState(
  ref: EntityRef,
  database?: TaschenmesserDB,
): Promise<PlanRowState> {
  if (ref.module === NEVER_LINKED) return { on: false };
  if (!availableManifests().some((m) => m.id === PLANNER)) return { on: false };
  if (!(await loadModuleStates(undefined, database))[PLANNER]) return { on: false };
  const day = await plannedDay(ref, database);
  return day ? { on: true, day } : { on: true };
}

/** Asks the thing into the plan: `plan.requested` with `ref`, once the planner's service listens. */
export async function requestIntoPlan(target: PlanRowTarget): Promise<void> {
  await whenServicesSettled();
  await bus.emit('plan.requested', {
    title: target.title,
    ref: target.ref,
    ...(target.due ? { due: { date: target.due, hard: true } } : {}),
  });
}

/**
 * The menu entry for a state, or nothing while the planner is off. `open` takes a route (the caller's
 * `navigate`): a placed thing leads to its day in the planner.
 */
export function planRowAction(
  target: PlanRowTarget,
  state: PlanRowState | undefined,
  labels: PlanRowLabels,
  open: (to: string) => void,
): PlanRowEntry | undefined {
  if (!state?.on) return undefined;
  const day = state.day;
  if (day)
    return {
      id: 'in-plan',
      label: labels.placed(dayName(day)),
      onSelect: () => open(`/planner?day=${encodeURIComponent(day)}`),
    };
  return { id: 'to-plan', label: labels.add, onSelect: () => void requestIntoPlan(target) };
}

/** Live `planRowAction`; nothing while loading, without a target or while the planner is off. */
export function usePlanRowAction(
  target: PlanRowTarget | undefined,
  labels: PlanRowLabels,
  open: (to: string) => void,
): PlanRowEntry | undefined {
  const key = target ? refKey(target.ref) : '';
  const state = useSharedLiveQuery(`planRow|${key}`, () =>
    target ? planRowState(target.ref) : undefined,
  );
  return target ? planRowAction(target, state, labels, open) : undefined;
}
