/**
 * One run of the planner (docs/design/plan/CONCEPT.md §2 "Runs and write-back"): gather the inputs
 * (sources, days, blockers, settings), let the engine plan, update the stored rows in place and write
 * the first day of every item back to its source – idempotently, so a rerun on the same input writes
 * nothing. Pure where it can be (`buildInputs`, `inputHash`, `writeBackPlan`); the effects are in
 * `runPlanner`. The service (`services.ts`) decides when a run happens; this file never reads a clock.
 */
import { getMeta, setMeta } from '@/core/db/metaKv';
import { addDays } from '@/core/plan/dates';
import { plan } from '@/core/plan/engine';
import type { PlanOp } from '@/core/plan/instructions';
import type {
  Assignment,
  PlanDay,
  PlanItem,
  PlanResult,
  PlanSettings,
  PrevAssignment,
  Unplaced,
} from '@/core/plan/types';
import {
  collectCalendarItems,
  collectPlanBlocks,
  collectPlannable,
  plannableSource,
  type PlanBlockEntry,
  type PlannableEntry,
  type RequestedIds,
} from '@/core/modules/contributions';
import { isPlannerOwned, type CalendarItem, type ModuleManifest } from '@/core/modules/types';
import { fixedOf, planDays, turnDayOf } from './days';
import { lateMoneyDue } from './late';
import { migratePins } from './migrateModel';
import { itemKeyOf, plannerRepos, putRow, type PlannerDb, type PlannerRepos } from './repo';
import type { AssignmentRow, PlanItemRow } from './schema';
import { planSettings, type PlannerSettings } from './settings';

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
  /** The module is switched off: hand the user's own date back, also one in the past (`PlannableSource.onRelease`). */
  onRelease(moduleId: string, id: string): Promise<void>;
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
  /** The service: the module was switched off meanwhile – a run still going writes nothing more. */
  aborted?: () => boolean;
  /** Test seams: fixed sources and calendar instead of the contributions. */
  entries?: PlannableEntry[];
  writer?: SourceWriter;
  calendar?: CalendarItem[];
  blocks?: PlanBlockEntry[];
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
  /** Items with a row that is „fest“: no proposal takes them. */
  lockedKeys: Set<string>;
  /**
   * A source's dated turns without a row (`PlannableItem.day`, `turnDayOf`): handed to the engine as where they lie, so
   * every proposal counts their time on that day as the board does. Never written as rows (`writeRows`).
   */
  turns: PrevAssignment[];
  /** Items whose rows a run takes away: „Nicht planen“ and late money. Nothing else is ever removed by a run. */
  removeKeys: Set<string>;
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

const max = (a?: string, b?: string): string | undefined => (!a ? b : !b ? a : a > b ? a : b);

/** Signature of assignment rows: (id, date, minutes, order, reason), sorted. */
export function rowsSignature(rows: readonly (AssignmentRow & { id: string })[]): string {
  return fnv1a(
    JSON.stringify(
      rows
        .map((r) => [
          r.id,
          r.date,
          r.minutes,
          r.order,
          r.reason,
          r.bumpedBy ?? [],
          r.late ?? false,
          ...(r.from ? [r.from, r.to] : []),
        ])
        .sort(),
    ),
  );
}

/**
 * What the person asked into the plan, per module: every live item row that is not excluded (`plan.requested`
 * with `ref` writes such a row; „Nicht planen“ or removing the row takes the thing out again). A source reads
 * its ids as `ctx.requested` and lists an undated thing only then (CONCEPT-SOURCES §3.1 rule 1, §3.3). Sorted,
 * so the same rows give the same lists on every device. A passed training let go (`skipped`) is no request.
 */
export function requestedIds(
  rows: readonly Pick<PlanItemRow, 'source' | 'excluded' | 'skipped'>[],
): RequestedIds {
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    if (r.excluded || r.skipped || !r.source?.module || !r.source.id) continue;
    (out[r.source.module] ??= []).push(r.source.id);
  }
  for (const ids of Object.values(out)) ids.sort();
  return out;
}

/** Everything the engine needs, plus the input hash (without `prev`, marks, planner-own dates or the assignment rows). */
export async function buildInputs(deps: RunDeps, repos: PlannerRepos): Promise<RunInputs> {
  const settings = planSettings(deps.settings, deps.planLimit);
  const horizon = Array.from({ length: settings.horizonDays }, (_, i) => addDays(deps.today, i));
  const until = horizon[horizon.length - 1]!;
  const itemRows = new Map<string, PlanItemRow>(
    (await repos.item.active().toArray()).map((r) => [r.id, r]),
  );
  // The requests come first: an undated thing (a shopping list) is listed only for an id asked into the plan.
  const entries =
    deps.entries ??
    (await collectPlannable(
      { today: deps.today, until },
      deps.manifests,
      requestedIds([...itemRows.values()]),
    ));
  const calendar = deps.settings.calendarBlocks
    ? (deps.calendar ??
      (await collectCalendarItems({ from: deps.today, to: until }, deps.manifests)))
    : [];
  // Time a module keeps free (a habit, S4): taken off the day like an appointment, so part of the hash below.
  const blocks =
    deps.blocks ?? (await collectPlanBlocks({ today: deps.today, until }, deps.manifests));
  const days: PlanDay[] = planDays({
    today: deps.today,
    span: settings.horizonDays,
    settings: deps.settings,
    dayRows: await repos.day.active().toArray(),
    calendar,
    blocks,
  }).map(({ date, availableMin, blockers, window }) => ({
    date,
    availableMin,
    blockers: blockers.map(({ id, label, min, from, to }) => ({
      id,
      label,
      min,
      ...(from && to ? { from, to } : {}),
    })),
    ...(window ? { window } : {}),
  }));
  const prevRows = new Map<string, AssignmentRow & { id: string }>(
    (await repos.assignment.active().toArray()).map((r) => [r.id, r]),
  );
  const inParts = new Set([...prevRows.values()].filter((r) => r.k > 0).map((r) => r.itemKey));
  const lockedKeys = new Set([...prevRows.values()].filter((r) => r.locked).map((r) => r.itemKey));
  // Rows the run itself may take away: of a thing the person took out („Nicht planen“) and of late money (D7).
  const removeKeys = new Set<string>();
  const laidKeys = new Set([...prevRows.values()].map((r) => r.itemKey));
  const turns: PrevAssignment[] = [];
  const userDates = new Map<string, string>();
  const titles: Record<string, string> = {};
  const items: PlanItem[] = [];
  for (const e of entries) {
    if (e.done) continue;
    const key = itemKeyOf(e.moduleId, e.id);
    const row = itemRows.get(key);
    titles[key] = e.title;
    // „Frist vorbei“ (D7): late money is no item of the run – it sits on no day, counts in no sum and no
    // sentence moves it. Its stored session rows go with this run (`writeRows`), a mark on its source with the
    // write-back (`writeBackPlan`); the input hash changes with the item list, so that run happens.
    if (lateMoneyDue(e, row, deps.today)) {
      removeKeys.add(key);
      continue;
    }
    if (row?.excluded) removeKeys.add(key);
    const turn = turnDayOf(e, {
      laid: laidKeys.has(key),
      excluded: row?.excluded === true,
      late: false,
    });
    if (turn) turns.push({ id: `${key}#0`, date: turn, reason: 'kept' });
    const userDate = e.plannedFor && !isPlannerOwned(e) ? e.plannedFor : undefined;
    if (userDate) userDates.set(key, userDate);
    const dueAny = row?.due?.hard ? row.due : (e.due ?? row?.due);
    // The engine places by day: a deadline's hour (`due.time`, package 5b) never reaches it.
    const due = dueAny ? { date: dueAny.date, hard: dueAny.hard } : undefined;
    const durationMin = row?.durationMin ?? e.durationMin;
    // A fixed block (S4) moves things, so it is an engine field and enters the hash with the items.
    const fixed = fixedOf(e);
    items.push({
      key,
      ...(durationMin !== undefined ? { durationMin } : {}),
      priority: (row?.priority ?? e.priority ?? 0) as PlanItem['priority'],
      ...(due ? { due } : {}),
      // The user's own date is a lower bound – also while the sync gate keeps it in memory only.
      // (The planner's old copy `row.earliest` is no longer read: nothing keeps it in step any more.)
      ...(max(e.earliest, userDate) ? { earliest: max(e.earliest, userDate) } : {}),
      // Nothing is cut into sessions by itself any more (planner rethink): a thing is one unit unless its stored
      // rows already are parts from the engine's time.
      splittable: inParts.has(key),
      ...(row?.excluded ? { excluded: true } : {}),
      ...(row?.part ? { part: row.part } : {}),
      ...(fixed ? { fixed } : {}),
      createdAt: e.createdAt ?? 0,
    });
  }
  // „Nicht planen“ also for a thing its source no longer lists (a list asked in by ref stops being listed once
  // it is taken out): its rows go too.
  for (const [key, row] of itemRows) if (row.excluded) removeKeys.add(key);
  const prev: PrevAssignment[] = [...prevRows.values()].map((r) => ({
    id: r.id,
    date: r.date,
    reason: r.reason,
    ...(r.bumpedBy ? { bumpedBy: r.bumpedBy } : {}),
  }));
  // Days with a fixed block (S4): what it takes depends on the blocker times it overlaps (`fixedCharges`).
  const fixedDays = new Set(items.flatMap((i) => (i.fixed ? [i.fixed.date] : [])));
  const hash = fnv1a(
    JSON.stringify({
      today: deps.today,
      settings,
      items: [...items].sort((a, b) => (a.key < b.key ? -1 : 1)),
      // Windows and blocker times only enter the hash where they matter (a day with a window or a fixed block): a
      // plan without either hashes as before, and moving an appointment elsewhere does not rerun.
      days: days.map((d) => [
        d.date,
        d.availableMin,
        d.blockers.map((b) =>
          (d.window || fixedDays.has(d.date)) && b.from
            ? [b.label, b.min, b.from, b.to]
            : [b.label, b.min],
        ),
        ...(d.window ? [d.window.from, d.window.to] : []),
      ]),
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
    lockedKeys,
    turns,
    removeKeys,
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
  /** The overflow of the run before this one (0 without one): the overload toast fires on 0 → above 0. */
  prevOverflowMin?: number;
}

/**
 * Writes the engine's assignments in place. A row is taken away only for a thing the person took out of the plan
 * („Nicht planen“) or for late money (`removeKeys`): a thing that is done, not listed right now (its module is
 * off, its source failed) or lies on a passed day keeps its row – the board hides it, nothing tidies it.
 */
export async function writeRows(
  result: PlanResult,
  inputs: RunInputs,
  repos: PlannerRepos,
  aborted?: () => boolean,
  /** The things the action named (`loose ∪ touched`): only for them a part that no longer exists is removed. */
  named?: ReadonlySet<string>,
): Promise<number> {
  let n = 0;
  const live = new Set<string>();
  // Every unit this run knows of (placed, waiting, left alone) and the things they belong to.
  const known = new Set([
    ...result.assignments.map((a) => a.id),
    ...result.unplaced.map((u) => u.id),
    ...(result.kept ?? []),
  ]);
  const knownItems = new Set([...result.assignments, ...result.unplaced].map((u) => u.itemKey));
  // A dated turn without a row is where its source says; it gets a row only from an action that lays it.
  const turnIds = new Set(inputs.turns.map((x) => x.id));
  // Nor does it take a place in its day's order: the rows after it keep the positions they had.
  const turnAt = result.assignments.filter((a) => turnIds.has(a.id) && !inputs.prevRows.has(a.id));
  const orderOf = (a: { date: string; order: number }) =>
    a.order - turnAt.filter((x) => x.date === a.date && x.order < a.order).length;
  for (const a of result.assignments) {
    if (aborted?.()) return n;
    live.add(a.id);
    if (turnIds.has(a.id) && !inputs.prevRows.has(a.id)) continue;
    const data: AssignmentRow = {
      itemKey: a.itemKey,
      k: a.k,
      of: a.of,
      date: a.date,
      minutes: a.minutes,
      order: orderOf(a),
      reason: a.reason,
      // „fest“ belongs to the row and survives every run; a thing a proposal moved was never locked.
      ...(inputs.prevRows.get(a.id)?.locked ? { locked: true } : {}),
      ...(a.bumpedBy?.length ? { bumpedBy: a.bumpedBy } : {}),
      ...(a.late ? { late: true } : {}),
      ...(a.from && a.to ? { from: a.from, to: a.to } : {}),
    };
    if (await putRow(repos.assignment, a.id, data)) n++;
  }
  for (const id of inputs.prevRows.keys()) {
    if (aborted?.()) return n;
    if (live.has(id)) continue;
    const key = inputs.prevRows.get(id)!.itemKey;
    // A part that no longer exists (the thing got shorter: three parts became two) goes – the thing itself is
    // listed and its other parts are known to this run.
    const stalePart = !known.has(id) && knownItems.has(key) && named?.has(key) === true;
    if (!inputs.removeKeys.has(key) && !stalePart) continue;
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
  touched?: ReadonlySet<string>,
): Promise<number> {
  const writer: SourceWriter = deps.writer ?? defaultWriter(deps.manifests);
  // A day that has passed is still the thing's day (it is „Noch offen“ there): the rows the engine left alone
  // count like the ones it set, so a missed thing keeps its date at the source.
  const keptRows = (result.kept ?? []).flatMap((id) => {
    const r = inputs.prevRows.get(id);
    return r ? [r as Assignment] : [];
  });
  const first = firstDays([...result.assignments, ...keptRows]);
  let n = 0;
  for (const e of inputs.entries) {
    if (deps.aborted?.()) break;
    if (e.done) continue;
    const key = itemKeyOf(e.moduleId, e.id);
    // The plan stays put: a source hears about a day only from the action that named the thing (`touched`).
    // A pass nobody asked for (start, midnight, an edit elsewhere) tells no source anything.
    if (touched && !touched.has(key)) continue;
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
  const sourceOf = (moduleId: string) => plannableSource(manifests.find((m) => m.id === moduleId));
  return {
    async onAssign(moduleId, id, date, order) {
      await (await sourceOf(moduleId))?.onAssign?.(id, date, order);
    },
    async onRelease(moduleId, id) {
      const source = await sourceOf(moduleId);
      if (source?.onRelease) await source.onRelease(id);
      else await source?.onAssign?.(id, undefined);
    },
  };
}

/**
 * One run. `force` (a user action) plans even when the input hash and the stored rows are unchanged.
 * Returns what happened; the caller (the service) owns the toast and the undo.
 */
export async function runPlanner(
  deps: RunDeps,
  opts: {
    force?: boolean;
    /** „alles neu mischen“: every thing that is not „fest“ is handed to the engine. */
    reshuffle?: boolean;
    /** Item keys the action hands to the engine (placed or moved by its rules); everything else stays. */
    loose?: readonly string[];
    /** Item keys the action named besides the loose ones: their source is told the day. */
    touched?: readonly string[];
    /** The ops of a sentence or sheet that was applied: what they hand over is read like in the preview (`looseOf`). */
    ops?: readonly PlanOp[];
    /** Narrows what is handed over (the seed: only its own things). */
    looseIf?: (itemKey: string) => boolean;
    /** „Rest verteilen“ of one day: its handed-over things go nowhere before that day (in memory, never stored). */
    notBefore?: string;
  } = {},
): Promise<RunOutcome> {
  const repos = plannerRepos(deps.database);
  const inputs = await buildInputs(deps, repos);
  // The step into „the plan stays put“: a pin of before (`item.pinned`) becomes „fest“ on the placement row. It is
  // found in the rows this run has read anyway – no start-up read of its own – and only once the sync has settled;
  // a pin that arrives later (an old backup, a device on the old version) is taken the same way. The source of a
  // thing the step laid on its pinned day hears that day.
  if (deps.settled && !deps.aborted?.() && [...inputs.itemRows.values()].some((r) => r.pinned)) {
    const moved: string[] = [];
    if ((await migratePins(deps.today, deps.database, moved)) > 0)
      return runPlanner(deps, {
        ...opts,
        force: true,
        touched: [...(opts.touched ?? []), ...moved],
      });
  }
  const last = await getMeta<LastRun>(LAST_RUN_KEY, deps.database);
  const rowsSig = rowsSignature([...inputs.prevRows.values()]);
  if (!opts.force && last && last.hash === inputs.hash && last.rowsSig === rowsSig)
    return { ran: false, inputs, rowWrites: 0, writeBacks: 0 };
  const bail = () => deps.aborted?.() === true;
  if (bail()) return { ran: false, inputs, rowWrites: 0, writeBacks: 0 };
  // What lies stays (docs/design/planner-rethink): the engine only gets the things the action handed over.
  // A thing the action laid itself (`touched`) is never handed over in the same breath – it stays where it was
  // laid, also in a reshuffle.
  const laidNow = new Set(opts.touched ?? []);
  const loose = (
    opts.reshuffle
      ? looseAll(inputs)
      : [...new Set([...(opts.loose ?? []), ...looseOf(inputs, opts.ops ?? [])])]
  ).filter(
    (k) => !laidNow.has(k) && !turnKeys(inputs).has(k) && (!opts.looseIf || opts.looseIf(k)),
  );
  const result = plan({
    today: deps.today,
    days: inputs.days,
    items: boundedItems(inputs.items, loose, opts.notBefore),
    prev: [...inputs.prev, ...inputs.turns],
    loose,
    settings: inputs.settings,
  });
  if (bail()) return { ran: false, inputs, rowWrites: 0, writeBacks: 0 };
  const rowWrites = await writeRows(
    result,
    inputs,
    repos,
    deps.aborted,
    new Set([...loose, ...(opts.touched ?? [])]),
  );
  const writeBacks = await writeBackPlan(
    result,
    inputs,
    deps,
    // What a run takes out of the plan („Nicht planen“, late money) is told to its source as well: the day the
    // planner once wrote there goes with the row.
    new Set([...loose, ...(opts.touched ?? []), ...inputs.removeKeys]),
  );
  if (bail()) return { ran: false, inputs, rowWrites, writeBacks };
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
  await setMeta(LAST_RUN_KEY, lastRun, deps.database);
  return {
    ran: true,
    result,
    inputs,
    rowWrites,
    writeBacks,
    // A run of an earlier day says nothing about today's start.
    prevOverflowMin: last?.today === deps.today ? last.overflowMin : 0,
  };
}

/**
 * The ops of a sentence (`core/plan/instructions.ts`) on the engine's inputs, in memory: what the plan
 * would look like after „Übernehmen“. Mirrors what `actions.ts applyOps` stores (a day's minutes and
 * blockers, the item flags, the thing's own date as earliest, its estimate, the buffer). Pure.
 */
export function withOps(
  inputs: Pick<RunInputs, 'days' | 'items' | 'settings'>,
  ops: readonly PlanOp[],
): { days: PlanDay[]; items: PlanItem[]; settings: PlanSettings; reshuffle: boolean } {
  const days = inputs.days.map((d) => ({ ...d, blockers: [...d.blockers] }));
  const items = inputs.items.map((i) => ({ ...i }));
  const settings = { ...inputs.settings };
  let reshuffle = false;
  const item = (key: string) => items.find((i) => i.key === key);
  for (const op of ops) {
    switch (op.op) {
      case 'available': {
        const d = days.find((x) => x.date === op.date);
        if (d) d.availableMin = op.min;
        break;
      }
      case 'block': {
        const d = days.find((x) => x.date === op.date);
        d?.blockers.push({ label: op.label, min: op.min });
        break;
      }
      case 'pin': {
        const i = item(op.key);
        if (i) i.pinned = op.date;
        break;
      }
      case 'earliest': {
        const i = item(op.key);
        // Like the run: the thing's own start date stays a lower bound.
        if (i) i.earliest = i.earliest && i.earliest > op.date ? i.earliest : op.date;
        break;
      }
      case 'priority': {
        const i = item(op.key);
        if (i) i.priority = op.value;
        break;
      }
      case 'exclude': {
        const i = item(op.key);
        if (i) i.excluded = true;
        break;
      }
      case 'duration': {
        const i = item(op.key);
        if (i) i.durationMin = op.min;
        break;
      }
      case 'buffer':
        settings.bufferShare = op.pct / 100;
        break;
      case 'replan':
        reshuffle ||= op.reshuffle;
        break;
    }
  }
  return { days, items, settings, reshuffle };
}

/**
 * A dry run for the preview: reads like a run, writes nothing, returns what the engine would do with `ops`.
 * `extra` = things not stored yet („Tage einteilen“: the dump's lines), planned as if they were there.
 */
export async function previewPlanner(
  deps: RunDeps,
  ops: readonly PlanOp[],
  extra: readonly PlanItem[] = [],
  /** A spread of one day („Rest verteilen“ on an overbooked day): these things, not before `notBefore`. */
  spread?: { loose: readonly string[]; notBefore: string },
): Promise<PreviewOutcome> {
  const inputs = await buildInputs(deps, plannerRepos(deps.database));
  const next = withOps({ ...inputs, items: [...inputs.items, ...extra] }, ops);
  const loose = [...new Set([...looseOf(inputs, ops, extra), ...(spread?.loose ?? [])])].filter(
    (k) => !turnKeys(inputs).has(k),
  );
  const result = plan({
    today: deps.today,
    days: next.days,
    items: boundedItems(next.items, loose, spread?.notBefore),
    prev: [...inputs.prev, ...inputs.turns],
    loose,
    settings: next.settings,
  });
  return { result, titles: inputs.titles, prev: inputs.prev };
}

/** A dated turn lies where its source says: no proposal moves it (moving it by hand writes its row). */
const turnKeys = (inputs: Pick<RunInputs, 'turns'>) =>
  new Set(inputs.turns.map((x) => x.id.slice(0, x.id.lastIndexOf('#'))));

/** The handed-over items may go nowhere before `notBefore` (a day's spread keeps its things on that day or later). */
function boundedItems(
  items: readonly PlanItem[],
  loose: readonly string[],
  notBefore: string | undefined,
): PlanItem[] {
  if (!notBefore) return [...items];
  const handed = new Set(loose);
  return items.map((i) =>
    handed.has(i.key) && !(i.earliest && i.earliest > notBefore)
      ? { ...i, earliest: notBefore }
      : i,
  );
}

/**
 * The chips „Vorschlag: Do · Frist Fr“ (planner rethink, CONCEPT §2): one dry `plan()` over every thing that gets a
 * chip, so two chips never claim the same room. What lies stays (a source's dated turn without a row counts on its
 * day); nothing is written, no source hears anything. Item key → the proposed day; a thing without room has none.
 */
export async function proposeDays(
  deps: RunDeps,
  keys: readonly string[],
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};
  const inputs = await buildInputs(deps, plannerRepos(deps.database));
  const laid = new Set([...inputs.prevRows.values()].map((r) => r.itemKey));
  const loose = keys.filter((k) => !inputs.lockedKeys.has(k) && !laid.has(k));
  const result = plan({
    today: deps.today,
    days: inputs.days,
    items: inputs.items,
    // A dated turn shown on its day without a row takes that day's time, as on the board.
    prev: [...inputs.prev, ...inputs.turns],
    loose,
    settings: inputs.settings,
  });
  const out: Record<string, string> = {};
  const wanted = new Set(loose);
  for (const a of [...result.assignments].sort((x, y) => x.date.localeCompare(y.date)))
    if (wanted.has(a.itemKey) && out[a.itemKey] === undefined) out[a.itemKey] = a.date;
  return out;
}

export interface PreviewOutcome {
  result: PlanResult;
  titles: Record<string, string>;
  prev: PrevAssignment[];
}

/** Every thing a proposal may take: all that is not „fest“. */
export function looseAll(inputs: Pick<RunInputs, 'items' | 'lockedKeys'>): string[] {
  return inputs.items.filter((i) => !inputs.lockedKeys.has(i.key)).map((i) => i.key);
}

/**
 * What a sentence or a sheet hands to the engine: the things an op names for another day (`pin`, `earliest`), the
 * typed things that are not stored yet (`extra`), and for „neu verteilen“ every thing without a day – for „alles
 * neu mischen“ every thing that is not „fest“. A spread never takes a thing that is „fest“; a move the person
 * names herself („schieb X auf Mi“) may.
 */
export function looseOf(
  inputs: Pick<RunInputs, 'items' | 'lockedKeys' | 'prevRows'>,
  ops: readonly PlanOp[],
  extra: readonly PlanItem[] = [],
): string[] {
  const out = new Set<string>(extra.map((i) => i.key));
  const laid = new Set([...inputs.prevRows.values()].map((r) => r.itemKey));
  for (const op of ops) {
    if (op.op === 'pin' || op.op === 'earliest') out.add(op.key);
    if (op.op === 'replan')
      for (const i of inputs.items) if (op.reshuffle || !laid.has(i.key)) out.add(i.key);
  }
  const named = new Set(ops.flatMap((op) => (op.op === 'pin' ? [op.key] : [])));
  return [...out].filter((k) => named.has(k) || !inputs.lockedKeys.has(k));
}

/**
 * Switching the module off: every marked thing goes back to its user through the sources (`prior`, also
 * a past one, or away – the same rule as the ToDo side's own clean-up) – in both data policies, before
 * the state and any wipe (`module.disabling`).
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
    await writer.onRelease(e.moduleId, e.id);
    n++;
  }
  return n;
}
