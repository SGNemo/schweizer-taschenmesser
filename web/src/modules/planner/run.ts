/**
 * One run of the planner (docs/design/plan/CONCEPT.md §2 "Runs and write-back"): gather the inputs
 * (sources, days, blockers, settings), let the engine plan, update the stored rows in place and write
 * the first day of every item back to its source – idempotently, so a rerun on the same input writes
 * nothing. Pure where it can be (`buildInputs`, `inputHash`, `writeBackPlan`); the effects are in
 * `runPlanner`. The service (`services.ts`) decides when a run happens; this file never reads a clock.
 */
import { readMeta, writeMeta } from '@/core/db/meta';
import { calendarBlockers } from '@/core/plan/capacity';
import { addDays } from '@/core/plan/dates';
import { plan } from '@/core/plan/engine';
import type {
  Assignment,
  PlanBlocker,
  PlanDay,
  PlanItem,
  PlanResult,
  PlanSettings,
  PrevAssignment,
  Unplaced,
} from '@/core/plan/types';
import {
  collectCalendarItems,
  collectPlannable,
  plannableSource,
  type PlannableEntry,
} from '@/core/modules/contributions';
import type { CalendarItem, ModuleManifest } from '@/core/modules/types';
import { isoWeekday } from '@/core/time/dates';
import { itemKeyOf, plannerRepos, putRow, type PlannerDb, type PlannerRepos } from './repo';
import type { AssignmentRow, PlanDayRow, PlanItemRow } from './schema';
import { defaultAvailable, planSettings, type PlannerSettings } from './settings';

export const HASH_KEY = 'planner.hash';
export const LAST_RUN_KEY = 'planner.lastRun';

/** Device-local memory of the last run (never synced): what the board shows besides the stored rows. */
export interface LastRun {
  today: string;
  hash: string;
  /** Signature of the assignment rows the run wrote, so a sync-applied change triggers a recompute. */
  rowsSig: string;
  unplaced: Unplaced[];
  overflowMin: number;
  demandMin: number;
  usableMin: number;
  /** Item key → title at the time of the run (for „Warum hier?“ of a thing that is gone meanwhile). */
  titles: Record<string, string>;
}

/** A write-back target: the source of one module. */
export interface SourceWriter {
  onAssign(moduleId: string, id: string, date: string | undefined, order?: number): Promise<void>;
}

export interface RunDeps {
  database?: PlannerDb;
  today: string;
  /** Active modules (sources and calendar). */
  manifests: readonly ModuleManifest[];
  settings: PlannerSettings;
  planLimit: number;
  /** `syncSettled()`: may a user's date be copied, cleared or overwritten? */
  settled: boolean;
  /** Test seams: fixed sources and calendar instead of the contributions. */
  entries?: PlannableEntry[];
  writer?: SourceWriter;
  calendar?: CalendarItem[];
}

export interface RunInputs {
  entries: PlannableEntry[];
  items: PlanItem[];
  days: PlanDay[];
  prev: PrevAssignment[];
  prevRows: Map<string, AssignmentRow & { id: string }>;
  itemRows: Map<string, PlanItemRow>;
  /** Item key → the user's own date (a source date the planner does not own), if any. */
  userDates: Map<string, string>;
  /** The planner's copy of a user's date (`item.earliest`) is out of step (new, changed or cleared): a run must bring it in step. */
  pendingEarliest: boolean;
  settings: PlanSettings;
  hash: string;
  titles: Record<string, string>;
  horizon: string[];
}

/** FNV-1a over a string, as hex: short, stable, good enough for "did the input change?". */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Planner-own or the user's? The mark must carry the same day (CONCEPT §2). */
export const isPlannerOwned = (e: Pick<PlannableEntry, 'plannedFor' | 'planMark'>): boolean =>
  e.plannedFor !== undefined && e.planMark?.date === e.plannedFor;

const max = (a?: string, b?: string): string | undefined => (!a ? b : !b ? a : a > b ? a : b);

/** Signature of assignment rows: (id, date, minutes, order, reason), sorted. */
export function rowsSignature(rows: readonly (AssignmentRow & { id: string })[]): string {
  return fnv1a(
    JSON.stringify(
      rows
        .map((r) => [r.id, r.date, r.minutes, r.order, r.reason, r.bumpedBy ?? [], r.late ?? false])
        .sort(),
    ),
  );
}

/** Everything the engine needs, plus the input hash (without `prev`, marks, planner-own dates or the assignment rows). */
export async function buildInputs(deps: RunDeps, repos: PlannerRepos): Promise<RunInputs> {
  const settings = planSettings(deps.settings, deps.planLimit);
  const horizon = Array.from({ length: settings.horizonDays }, (_, i) => addDays(deps.today, i));
  const until = horizon[horizon.length - 1]!;
  const entries =
    deps.entries ?? (await collectPlannable({ today: deps.today, until }, deps.manifests));
  const calendar = deps.settings.calendarBlocks
    ? (deps.calendar ??
      (await collectCalendarItems({ from: deps.today, to: until }, deps.manifests)))
    : [];
  const calBlockers = calendarBlockers(
    calendar.filter((i) => i.source !== 'planner'),
    { allDayBlocks: deps.settings.allDayBlocks },
  );
  const dayRows = new Map<string, PlanDayRow>(
    (await repos.day.active().toArray()).map((r) => [r.date, r]),
  );
  const days: PlanDay[] = horizon.map((date) => {
    const row = dayRows.get(date);
    const blockers: PlanBlocker[] = [
      ...(row?.blockers ?? []).map((b) => ({ id: b.id, label: b.label, min: b.min })),
      ...calBlockers
        .filter((b) => b.date === date)
        .map(({ id, label, min }) => ({ id, label, min })),
    ];
    return {
      date,
      availableMin: row?.availableMin ?? defaultAvailable(deps.settings, isoWeekday(date)),
      blockers,
    };
  });
  const itemRows = new Map<string, PlanItemRow>(
    (await repos.item.active().toArray()).map((r) => [r.id, r]),
  );
  const userDates = new Map<string, string>();
  const titles: Record<string, string> = {};
  const items: PlanItem[] = [];
  for (const e of entries) {
    if (e.done) continue;
    const key = itemKeyOf(e.moduleId, e.id);
    const row = itemRows.get(key);
    titles[key] = e.title;
    const userDate = e.plannedFor && !isPlannerOwned(e) ? e.plannedFor : undefined;
    if (userDate) userDates.set(key, userDate);
    const due = row?.due?.hard ? row.due : (e.due ?? row?.due);
    const durationMin = row?.durationMin ?? e.durationMin;
    items.push({
      key,
      ...(durationMin !== undefined ? { durationMin } : {}),
      priority: (row?.priority ?? e.priority ?? 0) as PlanItem['priority'],
      ...(due ? { due } : {}),
      // The user's own date is a lower bound – also while the sync gate keeps it in memory only.
      ...(max(e.earliest, userDate ?? row?.earliest)
        ? { earliest: max(e.earliest, userDate ?? row?.earliest) }
        : {}),
      ...(row?.pinned ? { pinned: row.pinned } : {}),
      splittable: row?.splittable ?? true,
      ...(row?.excluded ? { excluded: true } : {}),
      createdAt: e.createdAt ?? 0,
    });
  }
  const prevRows = new Map<string, AssignmentRow & { id: string }>(
    (await repos.assignment.active().toArray()).map((r) => [r.id, r]),
  );
  const prev: PrevAssignment[] = [...prevRows.values()].map((r) => ({
    id: r.id,
    date: r.date,
    reason: r.reason,
    ...(r.bumpedBy ? { bumpedBy: r.bumpedBy } : {}),
  }));
  const pendingEarliest = entries.some((e) => {
    if (e.done) return false;
    const key = itemKeyOf(e.moduleId, e.id);
    const row = itemRows.get(key);
    const userDate = userDates.get(key);
    return userDate ? row?.earliest !== userDate : !e.plannedFor && row?.earliest !== undefined;
  });
  const hash = fnv1a(
    JSON.stringify({
      today: deps.today,
      settings,
      items: [...items].sort((a, b) => (a.key < b.key ? -1 : 1)),
      days: days.map((d) => [d.date, d.availableMin, d.blockers.map((b) => [b.label, b.min])]),
    }),
  );
  return {
    entries,
    items,
    days,
    prev,
    prevRows,
    itemRows,
    userDates,
    pendingEarliest,
    settings,
    hash,
    titles,
    horizon,
  };
}

/** The first day and the in-day position of every assigned item (the day's order, first sessions only). */
export function firstDays(
  assignments: readonly Assignment[],
): Map<string, { date: string; order: number }> {
  const out = new Map<string, { date: string; order: number }>();
  const byDate = new Map<string, Assignment[]>();
  for (const a of assignments) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  for (const date of [...byDate.keys()].sort()) {
    const list = byDate.get(date)!.sort((a, b) => a.order - b.order);
    let order = 0;
    for (const a of list) {
      if (out.has(a.itemKey)) continue;
      out.set(a.itemKey, { date, order: order++ });
    }
  }
  return out;
}

export interface RunOutcome {
  ran: boolean;
  result?: PlanResult;
  inputs: RunInputs;
  /** Rows written or removed in this run. */
  rowWrites: number;
  /** Write-backs that reached a source. */
  writeBacks: number;
}

/** Keeps the planner-owned item rows in step with the user's own date (copy, replace, remove) – only while the gate is open. */
async function syncEarliest(
  inputs: RunInputs,
  repos: PlannerRepos,
  settled: boolean,
): Promise<number> {
  if (!settled) return 0;
  let n = 0;
  for (const e of inputs.entries) {
    if (e.done) continue;
    const key = itemKeyOf(e.moduleId, e.id);
    const row = inputs.itemRows.get(key);
    const userDate = inputs.userDates.get(key);
    if (userDate) {
      if (row?.earliest === userDate) continue;
      const data: PlanItemRow = row
        ? { ...rowData(row), earliest: userDate }
        : { source: { module: e.moduleId, id: e.id }, order: 0, earliest: userDate };
      if (await putRow(repos.item, key, data)) n++;
    } else if (!e.plannedFor && row?.earliest) {
      // The user cleared the date: the copy goes too.
      const { earliest: _gone, ...rest } = rowData(row);
      void _gone;
      if (await putRow(repos.item, key, rest)) n++;
    }
  }
  return n;
}

const rowData = (row: PlanItemRow): PlanItemRow => {
  const {
    source,
    title,
    durationMin,
    priority,
    due,
    earliest,
    pinned,
    splittable,
    excluded,
    order,
  } = row;
  return {
    source,
    ...(title !== undefined ? { title } : {}),
    ...(durationMin !== undefined ? { durationMin } : {}),
    ...(priority !== undefined ? { priority } : {}),
    ...(due ? { due } : {}),
    ...(earliest ? { earliest } : {}),
    ...(pinned ? { pinned } : {}),
    ...(splittable !== undefined ? { splittable } : {}),
    ...(excluded ? { excluded } : {}),
    order,
  };
};

/** Writes the engine's assignments in place and removes the units that stopped being placed. */
export async function writeRows(
  result: PlanResult,
  inputs: RunInputs,
  repos: PlannerRepos,
): Promise<number> {
  let n = 0;
  const live = new Set<string>();
  for (const a of result.assignments) {
    live.add(a.id);
    const data: AssignmentRow = {
      itemKey: a.itemKey,
      k: a.k,
      of: a.of,
      date: a.date,
      minutes: a.minutes,
      order: a.order,
      reason: a.reason,
      ...(a.bumpedBy?.length ? { bumpedBy: a.bumpedBy } : {}),
      ...(a.late ? { late: true } : {}),
    };
    if (await putRow(repos.assignment, a.id, data)) n++;
  }
  for (const id of inputs.prevRows.keys()) {
    if (live.has(id)) continue;
    await repos.assignment.remove(id);
    n++;
  }
  return n;
}

/**
 * Tells every source where its things landed: the first day in the plan's order, `undefined` for a
 * thing that waits or is excluded. A user's own date is only overwritten or cleared while the sync
 * gate is open; the source itself writes only when something differs.
 */
export async function writeBackPlan(
  result: PlanResult,
  inputs: RunInputs,
  deps: RunDeps,
): Promise<number> {
  const writer: SourceWriter = deps.writer ?? defaultWriter(deps.manifests);
  const first = firstDays(result.assignments);
  let n = 0;
  for (const e of inputs.entries) {
    if (e.done) continue;
    const key = itemKeyOf(e.moduleId, e.id);
    const userSet = inputs.userDates.has(key);
    if (!deps.settled && userSet) continue; // gate closed: used in memory only
    const target = first.get(key);
    if (target) {
      if (isPlannerOwned(e) && e.plannedFor === target.date && e.planMark?.order === target.order)
        continue;
      await writer.onAssign(e.moduleId, e.id, target.date, target.order);
      n++;
    } else if (e.planMark || isPlannerOwned(e)) {
      await writer.onAssign(e.moduleId, e.id, undefined);
      n++;
    }
  }
  return n;
}

function defaultWriter(manifests: readonly ModuleManifest[]): SourceWriter {
  return {
    async onAssign(moduleId, id, date, order) {
      const source = await plannableSource(manifests.find((m) => m.id === moduleId));
      await source?.onAssign?.(id, date, order);
    },
  };
}

/**
 * One run. `force` (a user action) plans even when the input hash and the stored rows are unchanged.
 * Returns what happened; the caller (the service) owns the toast and the undo.
 */
export async function runPlanner(
  deps: RunDeps,
  opts: { force?: boolean } = {},
): Promise<RunOutcome> {
  const repos = plannerRepos(deps.database);
  const inputs = await buildInputs(deps, repos);
  const last = await readMeta<LastRun>(LAST_RUN_KEY, deps.database);
  const rowsSig = rowsSignature([...inputs.prevRows.values()]);
  if (
    !opts.force &&
    last &&
    last.hash === inputs.hash &&
    last.rowsSig === rowsSig &&
    !(deps.settled && inputs.pendingEarliest)
  )
    return { ran: false, inputs, rowWrites: 0, writeBacks: 0 };
  let rowWrites = await syncEarliest(inputs, repos, deps.settled);
  const result = plan({
    today: deps.today,
    days: inputs.days,
    items: inputs.items,
    prev: inputs.prev,
    settings: inputs.settings,
  });
  rowWrites += await writeRows(result, inputs, repos);
  const writeBacks = await writeBackPlan(result, inputs, deps);
  const written = (await repos.assignment.active().toArray()) as (AssignmentRow & { id: string })[];
  const lastRun: LastRun = {
    today: deps.today,
    hash: inputs.hash,
    rowsSig: rowsSignature(written),
    unplaced: result.unplaced,
    overflowMin: result.overflowMin,
    demandMin: result.demandMin,
    usableMin: result.usableMin,
    titles: inputs.titles,
  };
  await writeMeta(LAST_RUN_KEY, lastRun, deps.database);
  await writeMeta(HASH_KEY, inputs.hash, deps.database);
  return { ran: true, result, inputs, rowWrites, writeBacks };
}

/**
 * Switching the module off: every planner-own date goes back to the user (`prior`, or away) through
 * the sources – in both data policies, before the state and any wipe (`module.disabling`).
 */
export async function restoreSources(
  deps: Pick<RunDeps, 'manifests' | 'entries' | 'writer' | 'today'>,
): Promise<number> {
  const writer: SourceWriter = deps.writer ?? defaultWriter(deps.manifests);
  const entries =
    deps.entries ??
    (await collectPlannable({ today: deps.today, until: deps.today }, deps.manifests));
  let n = 0;
  for (const e of entries) {
    if (!e.planMark) continue;
    await writer.onAssign(e.moduleId, e.id, undefined);
    n++;
  }
  return n;
}
