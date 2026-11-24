/**
 * What the mark „Im Plan · Mi“ says about a thing in its own module (planner hub 2, CONCEPT §1.2 „Occurrence keys“,
 * §1.4; hand-off 10). Read from the planner's rows only – nothing is written, ever.
 *
 *  - **Own keys.** A plan item key belongs to the thing when it is `<module>:<id>` or starts with `<module>:<id>:`
 *    (subscriptions, routines and Unterlagen plan per occurrence). `todos:ab` never matches `todos:abc`.
 *  - **Carriers.** A thing that is no plan row (a note, a mail thread, an event) has the day of a ToDo linking to it
 *    with `origin` or `about` – never `before`, `after` or `topic`: a preparation the day before must not move the
 *    appointment's mark.
 *  - **Order.** The earliest live day from today on (own rows first, then carriers) → M1 / M2; else the latest live
 *    day before today of the exact key or an open carrier → M4 (an occurrence that passed is gone – its next one is
 *    a new key); else the planner's own item row asked in and not excluded → M3; else the module's `fallback`
 *    (bookmarks `inPlan`, subscriptions `plannedDeadline`: their request while the planner has no row yet) → M3.
 *  - `rowKey` is the plan row that was matched (the occurrence key, the carrier ToDo's key), so a tap lands on it.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { dateTimeFormat } from '@/core/i18n/format';
import { loadModuleStates } from '@/core/modules/activation';
import { availableManifests } from '@/core/modules/available';
import { getManifest } from '@/core/modules/registry';
import { dayName } from '@/core/plan/explain';
import { addDaysStr } from '@/core/time/dates';
import { today } from '@/core/time/now';
import { t } from '@/strings';
import { linksRepo, readLink } from './store';
import { NEVER_LINKED, refKey } from './types';

const PLANNER = 'planner';
/** The relations that give a thing its carrier's day (CONCEPT §1.4). */
const CARRIER_RELS = new Set(['origin', 'about']);

/** Where a thing stands in the plan; `null` (in a map: missing) is „not in the plan“, no mark. */
export type PlanMarkState =
  /** M1 / M2 (M5 once package 2 names the pile). */
  | { kind: 'day'; date: string; locked: boolean; rowKey: string; pile?: string }
  /** M3 */
  | { kind: 'noDay'; rowKey: string }
  /** M4 */
  | { kind: 'passed'; date: string; rowKey: string };

/** What a module adds of its own: its request field (M3 while the planner has no row) and whether the thing is done. */
export interface PlanMarkInput {
  id: string;
  /** The module's own „im Plan“ field (bookmarks `inPlan`, subscriptions `plannedDeadline`). */
  fallback?: boolean;
  /** A done thing has no mark. */
  done?: boolean;
}

export interface Placed {
  key: string;
  date: string;
  locked: boolean;
}

/** The owner id of a plan item key among `ids`: the exact key first, then the longest `<id>:` prefix. */
function ownerOf(module: string, key: string, ids: ReadonlySet<string>): string | undefined {
  if (!key.startsWith(`${module}:`)) return undefined;
  const rest = key.slice(module.length + 1);
  if (ids.has(rest)) return rest;
  for (let at = rest.lastIndexOf(':'); at > 0; at = rest.lastIndexOf(':', at - 1)) {
    const id = rest.slice(0, at);
    if (ids.has(id)) return id;
  }
  return undefined;
}

/** Is the planner on (and in this build, on this platform). */
async function plannerOn(database: TaschenmesserDB): Promise<boolean> {
  if (!availableManifests().some((m) => m.id === PLANNER)) return false;
  return !!(await loadModuleStates(undefined, database))[PLANNER];
}

/** The live placements of a set of keys and prefixes, grouped by key. */
async function placements(
  keys: readonly string[],
  prefixes: readonly string[],
  database: TaschenmesserDB,
): Promise<Placed[]> {
  const planner = getManifest(PLANNER)!;
  const table = createCollectionRepo(planner, 'assignment', database).table;
  const [exact, pre] = await Promise.all([
    keys.length ? table.where('itemKey').anyOf(keys).toArray() : [],
    prefixes.length ? table.where('itemKey').startsWithAnyOf(prefixes).toArray() : [],
  ]);
  const out: Placed[] = [];
  const seen = new Set<string>();
  for (const r of [...exact, ...pre]) {
    if (seen.has(r.id) || r.deletedAt !== null) continue;
    seen.add(r.id);
    if (typeof r.itemKey !== 'string' || typeof r.date !== 'string') continue;
    out.push({ key: r.itemKey, date: r.date, locked: r.locked === true });
  }
  return out;
}

/** The earliest day from `from` on (locked when any live row of that key on that day is), else undefined. */
function earliestFrom(rows: readonly Placed[], from: string): Placed | undefined {
  let best: Placed | undefined;
  for (const r of rows) {
    if (r.date < from) continue;
    if (!best || r.date < best.date || (r.date === best.date && r.key < best.key)) best = r;
  }
  if (!best) return undefined;
  const locked = rows.some((r) => r.key === best.key && r.date === best.date && r.locked);
  return { ...best, locked };
}

/** The latest day before `from`. */
function latestBefore(rows: readonly Placed[], from: string): Placed | undefined {
  let best: Placed | undefined;
  for (const r of rows) {
    if (r.date >= from) continue;
    if (!best || r.date > best.date || (r.date === best.date && r.key < best.key)) best = r;
  }
  return best;
}

/** The thing's own placements (exact and per occurrence) and its carriers' (`origin` / `about` ToDos). */
async function gather(module: string, ids: ReadonlySet<string>, database: TaschenmesserDB) {
  const keys = [...ids].map((id) => refKey({ module, id }));
  const prefixes = keys.map((k) => `${k}:`);
  // Own rows, exact and per occurrence.
  const own = new Map<string, Placed[]>();
  for (const p of await placements(keys, prefixes, database)) {
    const id = ownerOf(module, p.key, ids);
    if (id !== undefined) own.set(id, [...(own.get(id) ?? []), p]);
  }

  // Carriers: ToDos linking to the thing with `origin` / `about` (read like `linkEntries`, vault and unknown dropped).
  const carriersOf = new Map<string, string[]>();
  const linkRows = await linksRepo(database).table.where('toKey').anyOf(keys).toArray();
  for (const row of linkRows) {
    if (row.deletedAt !== null) continue;
    const link = readLink(row);
    if (!link || link.from.module !== 'todos' || !CARRIER_RELS.has(link.rel)) continue;
    if (link.to.module !== module || !ids.has(link.to.id)) continue;
    carriersOf.set(link.to.id, [...(carriersOf.get(link.to.id) ?? []), refKey(link.from)]);
  }
  const carrierKeys = [...new Set([...carriersOf.values()].flat())];
  const carrierRows = new Map<string, Placed[]>();
  for (const p of await placements(carrierKeys, [], database))
    carrierRows.set(p.key, [...(carrierRows.get(p.key) ?? []), p]);
  // A done carrier no longer stands for the thing on a passed day.
  const doneCarriers = new Set<string>();
  const todos = getManifest('todos');
  if (todos?.dataSchema.collections.task && carrierKeys.length) {
    const tasks = await createCollectionRepo(todos, 'task', database).table.bulkGet(
      carrierKeys.map((k) => k.slice('todos:'.length)),
    );
    tasks.forEach((task, i) => {
      if (!task || task.deletedAt !== null || task.done === true) doneCarriers.add(carrierKeys[i]!);
    });
  }

  return { own, carriersOf, carrierRows, doneCarriers };
}

/** Every live placement standing for each thing: its own rows and its carriers'. */
export async function placementsOf(
  module: string,
  ids: readonly string[],
  database: TaschenmesserDB = defaultDb,
): Promise<Map<string, Placed[]>> {
  const set = new Set(ids);
  const { own, carriersOf, carrierRows } = await gather(module, set, database);
  const out = new Map<string, Placed[]>();
  for (const id of set) {
    const rows = [
      ...(own.get(id) ?? []),
      ...(carriersOf.get(id) ?? []).flatMap((k) => carrierRows.get(k) ?? []),
    ];
    if (rows.length) out.set(id, rows);
  }
  return out;
}

/**
 * The marks of several things of one module (a list's rows), in a handful of indexed reads. `undefined` while the
 * planner is off or not in this build (nothing is drawn); things without a mark are missing from the map.
 */
export async function planMarks(
  module: string,
  things: readonly PlanMarkInput[],
  database: TaschenmesserDB = defaultDb,
): Promise<Map<string, PlanMarkState> | undefined> {
  if (module === NEVER_LINKED) return undefined;
  const planner = getManifest(PLANNER);
  if (!planner?.dataSchema.collections.assignment || !planner.dataSchema.collections.item)
    return undefined;
  if (!(await plannerOn(database))) return undefined;
  const out = new Map<string, PlanMarkState>();
  const open = things.filter((x) => !x.done);
  if (open.length === 0) return out;
  const ids = new Set(open.map((x) => x.id));
  const keys = open.map((x) => refKey({ module, id: x.id }));
  const prefixes = keys.map((k) => `${k}:`);
  const from = today();

  const { own, carriersOf, carrierRows, doneCarriers } = await gather(module, ids, database);

  // The planner's own item rows: asked in (M3) or „Nicht planen“.
  const items = createCollectionRepo(planner, 'item', database).table;
  const [exactItems, occItems] = await Promise.all([
    items.bulkGet(keys),
    items.where(':id').startsWithAnyOf(prefixes).toArray(),
  ]);
  const excluded = new Set<string>();
  const asked = new Map<string, string>();
  for (const row of [...exactItems, ...occItems]) {
    if (!row || row.deletedAt !== null) continue;
    const id = ownerOf(module, row.id, ids);
    if (id === undefined) continue;
    if (row.excluded === true) {
      if (row.id === refKey({ module, id })) excluded.add(id);
    } else if (!asked.has(id)) asked.set(id, row.id);
  }

  for (const thing of open) {
    const id = thing.id;
    if (excluded.has(id)) continue;
    const key = refKey({ module, id });
    const mine = own.get(id) ?? [];
    const carried = (carriersOf.get(id) ?? []).flatMap((k) => carrierRows.get(k) ?? []);
    const day = earliestFrom(mine, from) ?? earliestFrom(carried, from);
    if (day) {
      out.set(id, { kind: 'day', date: day.date, locked: day.locked, rowKey: day.key });
      continue;
    }
    const passed =
      latestBefore(
        mine.filter((p) => p.key === key),
        from,
      ) ??
      latestBefore(
        carried.filter((p) => !doneCarriers.has(p.key)),
        from,
      );
    if (passed) {
      out.set(id, { kind: 'passed', date: passed.date, rowKey: passed.key });
      continue;
    }
    const askedKey = asked.get(id);
    if (askedKey) out.set(id, { kind: 'noDay', rowKey: askedKey });
    else if (thing.fallback) out.set(id, { kind: 'noDay', rowKey: key });
  }
  return out;
}

/** The mark of one thing: `undefined` while the planner is off, `null` when it is not in the plan. */
export async function planMarkOf(
  module: string,
  thing: PlanMarkInput,
  database: TaschenmesserDB = defaultDb,
): Promise<PlanMarkState | null | undefined> {
  const map = await planMarks(module, [thing], database);
  return map ? (map.get(thing.id) ?? null) : undefined;
}

/** How far a day is named by its weekday alone („Mi“); later ones carry the date („Mi 2.12.“). */
export const WEEKDAY_SPAN = 6;

/** „heute“, „Mi“ or „Mi 2.12.“ – the planner's day names, a day beyond the coming week with its date. */
export function planDayLabel(date: string, day: string = today()): string {
  if (date === day) return t.planner.mark.today;
  if (date >= addDaysStr(day, -WEEKDAY_SPAN) && date <= addDaysStr(day, WEEKDAY_SPAN))
    return dayName(date);
  const short = dateTimeFormat({ day: 'numeric', month: 'numeric' }).format(
    new Date(`${date}T12:00:00`),
  );
  return `${dayName(date)} ${short}`;
}

/** The visible words M1–M5. */
export function planMarkText(state: PlanMarkState, day: string = today()): string {
  const m = t.planner.mark;
  switch (state.kind) {
    case 'day': {
      const label = planDayLabel(state.date, day);
      if (state.pile) return m.inPile(label, state.pile);
      return state.locked ? m.locked(label) : m.day(label);
    }
    case 'noDay':
      return m.noDay;
    case 'passed':
      return m.passed(planDayLabel(state.date, day));
  }
}

/** M6: the visible words, then the full date where there is one. */
export function planMarkName(state: PlanMarkState, day: string = today()): string {
  const text = planMarkText(state, day);
  if (state.kind === 'noDay') return t.planner.mark.nameNoDate(text);
  const full = dateTimeFormat({ weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(`${state.date}T12:00:00`),
  );
  return t.planner.mark.name(text, full);
}

/** Where a tap leads: the plan row that was matched – on its day, in „Noch offen“, or under „Noch ohne Tag“. */
export function planMarkPath(state: PlanMarkState): string {
  const item = encodeURIComponent(state.rowKey);
  if (state.kind === 'day') return `/planner?day=${state.date}&item=${item}`;
  if (state.kind === 'passed') return `/planner?tab=open&item=${item}`;
  return `/planner?item=${item}`;
}
