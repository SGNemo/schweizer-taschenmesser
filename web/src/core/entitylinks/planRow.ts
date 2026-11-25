/**
 * The generic row action „In den Plan“ of a thing that is a plan item itself – a list, an invoice
 * (docs/design/planner-hub/CONCEPT-SOURCES.md §3.3). It lives here, not under `core/plan/**`, which stays free of
 * database and registry imports.
 *
 *  - Shown only while the planner module is on: the bus has no reply, so the helper reads the module state itself.
 *  - Not placed yet: the entry emits `plan.requested` with `ref`. The planner writes its own item row for
 *    `<module>:<id>` and creates no ToDo; for a thing without a date that row is what switches it on as a source.
 *  - Placed: the entry reads „Im Plan · Di“ (`plannedDay`) and opens the planner on that day.
 *  - Asked in (the planner's item row is live and not excluded) but without a day yet: „Im Plan · noch ohne Tag“,
 *    opens the planner. A request has no end of its own (an emptied list returns with its next entry), so while
 *    it stands or the thing is placed a second entry „Nicht mehr planen“ emits `plan.unrequested`: the planner
 *    excludes its item row, one undo.
 *
 * The wording comes from the caller (its module's own strings), so every module names the action in its block.
 */
import { bus } from '@/core/events';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { whenServicesSettled } from '@/core/modules/servicesReady';
import { useSharedLiveQuery } from '@/core/modules/sharedQuery';
import { dayName } from '@/core/plan/explain';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { plannedDay } from './index';
import { placementsOf } from './planMarkRead';
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
  /** „Im Plan · noch ohne Tag“: asked in, no day free yet. */
  waits: string;
  /** „Nicht mehr planen“ */
  remove: string;
}

/** Is the planner on, and on which day does the thing stand. */
export interface PlanRowState {
  on: boolean;
  /** 'YYYY-MM-DD' of its earliest day from today on; missing while it is not placed. */
  day?: string;
  /** Asked into the plan: the planner's item row for the thing is live and not excluded. */
  requested?: boolean;
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
  const [day, requested] = await Promise.all([
    plannedDay(ref, database),
    isRequested(ref, database),
  ]);
  return { on: true, ...(day ? { day } : {}), ...(requested ? { requested } : {}) };
}

/** Is the planner's own item row `<module>:<id>` live and not excluded (read like `plannedDay`, nothing written). */
async function isRequested(
  ref: EntityRef,
  database: TaschenmesserDB = defaultDb,
): Promise<boolean> {
  const planner = getManifest(PLANNER);
  if (!planner?.dataSchema.collections.item) return false;
  const row = await createCollectionRepo(planner, 'item', database).table.get(refKey(ref));
  return !!row && row.deletedAt === null && !row.excluded;
}

/** What the planner knows of a thing beyond its day: „fest“ (a live row of it is locked) and „Nicht planen“. */
export interface PlanFacts {
  locked?: true;
  excluded?: true;
}

/**
 * „fest“ and „Nicht planen“ of several things of one module (the ToDo list's filter, todos-plan-state), read like
 * `isRequested`: the planner's item rows (`excluded`) and its live placement rows (`locked`) – the thing's own, an
 * occurrence's (`<module>:<id>:…`) and an `origin` / `about` carrier ToDo's, as the mark reads them. Nothing written. Only
 * things with a fact are in the map; empty while the planner is off or not in this build.
 */
export async function planFacts(
  module: string,
  ids: readonly string[],
  database: TaschenmesserDB = defaultDb,
): Promise<Map<string, PlanFacts>> {
  const out = new Map<string, PlanFacts>();
  const planner = getManifest(PLANNER);
  if (ids.length === 0 || module === NEVER_LINKED) return out;
  if (!planner?.dataSchema.collections.item || !planner.dataSchema.collections.assignment)
    return out;
  if (!(await loadModuleStates(undefined, database))[PLANNER]) return out;
  const keys = ids.map((id) => refKey({ module, id }));
  const idOf = (key: string) => key.slice(module.length + 1);
  const items = await createCollectionRepo(planner, 'item', database).table.bulkGet(keys);
  for (const row of items)
    if (row && row.deletedAt === null && row.excluded === true)
      out.set(idOf(row.id as string), { excluded: true });
  // „fest“ read like the mark: its own rows, exact or per occurrence, and its `origin` / `about` carriers' rows.
  for (const [id, rows] of await placementsOf(module, ids, database))
    if (rows.some((r) => r.locked)) out.set(id, { ...out.get(id), locked: true });
  return out;
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
 * „In den Plan …“ with a day for several things (todos-plan-state): one `plan.requested` with `refs` – the planner lays
 * them on `day` ('YYYY-MM-DD') or leaves them without a day (`null`), as one undo with one toast.
 */
export async function requestManyIntoPlan(refs: EntityRef[], day: string | null): Promise<void> {
  if (refs.length === 0) return;
  await whenServicesSettled();
  await bus.emit('plan.requested', { title: '', refs, day });
}

/** Takes the thing out of the plan again: `plan.unrequested`, the planner excludes its item row (one undo). */
export async function unrequestFromPlan(target: PlanRowTarget): Promise<void> {
  await whenServicesSettled();
  await bus.emit('plan.unrequested', { title: target.title, ref: target.ref });
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
  if (state.requested)
    return { id: 'in-plan', label: labels.waits, onSelect: () => open('/planner') };
  return { id: 'to-plan', label: labels.add, onSelect: () => void requestIntoPlan(target) };
}

/** `planRowAction` plus „Nicht mehr planen“ while the thing is asked in or placed; empty while the planner is off. */
export function planRowEntries(
  target: PlanRowTarget,
  state: PlanRowState | undefined,
  labels: PlanRowLabels,
  open: (to: string) => void,
): PlanRowEntry[] {
  const main = planRowAction(target, state, labels, open);
  if (!main) return [];
  if (!state?.day && !state?.requested) return [main];
  return [
    main,
    { id: 'not-in-plan', label: labels.remove, onSelect: () => void unrequestFromPlan(target) },
  ];
}

/** Live `planRowEntries`; nothing while loading, without a target or while the planner is off. */
export function usePlanRowEntries(
  target: PlanRowTarget | undefined,
  labels: PlanRowLabels,
  open: (to: string) => void,
): PlanRowEntry[] {
  const key = target ? refKey(target.ref) : '';
  const state = useSharedLiveQuery(`planRow|${key}`, () =>
    target ? planRowState(target.ref) : undefined,
  );
  return target ? planRowEntries(target, state, labels, open) : [];
}
