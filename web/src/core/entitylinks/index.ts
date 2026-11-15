/**
 * Links between entities of different modules – the only writer and reader of the synced table `_links`
 * (docs/design/planner-hub/CONCEPT-LINKS.md §1.1–§1.4). One row per link with a hashed, deterministic id
 * (`./store`), so adds on two devices commute and a removal is the tombstone of that one link.
 *
 *  - `addLink` is a tap: idempotent, brings a removed link back, returns its undo.
 *  - `addLinkIfAbsent` is every other writer (the copy of the ToDo links, a programmatic add): it creates only
 *    when no row exists – a tombstone counts as present, so a removal wins over a stale re-add.
 *  - Reads drop every row with an end in the vault or in a module without `linkTarget` (`readLink`).
 *
 * No data API, local API, assistant, search, share file, automation or diagnostics text ever sees a row: those
 * surfaces enumerate manifests, and this table belongs to none (`exclusion.test.ts`).
 */
import { useMemo } from 'react';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { loadModuleStates } from '@/core/modules/activation';
import { resolveLink, useResolvedLinks } from '@/core/modules/contributions';
import { getManifest, visibleManifests } from '@/core/modules/registry';
import { useSharedLiveQuery } from '@/core/modules/sharedQuery';
import type { ResolvedState } from '@/core/modules/types';
import { today } from '@/core/time/now';
import {
  carrierStamp,
  linkId,
  linksRepo,
  readLink,
  toRow,
  writeStamped,
  type LinkRow,
  type StoredLink,
} from './store';
import { refKey, refOfKind, type EntityLink, type EntityRef, type LegacyLink } from './types';

export { linkId } from './store';
export type { EntityLink, EntityRef, LinkRel } from './types';

/** A link as stored, seen from one of its ends. */
export interface LinkEntry {
  /** The row id (`removeLink`). */
  id: string;
  link: EntityLink;
  /** `out`: the asked thing carries the link; `in`: the link leads to it. */
  direction: 'out' | 'in';
  /** The other end. */
  other: EntityRef;
}

/** A link with what its other end is on this device (`resolveLink`). */
export interface ResolvedLink extends LinkEntry {
  state: ResolvedState;
}

const noop = async (): Promise<void> => undefined;

/**
 * Adds a link by a tap. Nothing there → the row is created. Removed before → the same row comes back (with the
 * label and day of now). Already live → nothing is written, except for a `dunning` link: a later reminder in
 * the same thread takes over its label and day (the undo puts the earlier ones back). Returns the undo of what
 * it did.
 * Throws for the vault, a module that is no link target, a link to itself or a malformed day.
 */
export async function addLink(
  link: EntityLink,
  database: TaschenmesserDB = defaultDb,
): Promise<() => Promise<void>> {
  const data = toRow(link);
  const id = await linkId(data as EntityLink);
  const repo = linksRepo(database);
  const existing = await repo.table.get(id);
  if (existing?.deletedAt === null) {
    // A later reminder in the same thread is the same link: it carries the latest reminder's day and subject.
    // Every other live link stays as it is (a tap on what is there writes nothing).
    if (data.rel !== 'dunning' || (existing.on === data.on && existing.label === data.label))
      return noop;
    const before = { label: existing.label, on: existing.on };
    await repo.update(id, { label: data.label, on: data.on });
    return async () => {
      await repo.update(id, before);
    };
  }
  if (!existing) {
    // `createMany` skips an id that appeared meanwhile (a pull): the add stays idempotent.
    const created = await repo.createMany([{ data, id }]);
    return created.length > 0 ? () => repo.remove(id) : noop;
  }
  await repo.restore(id);
  await repo.update(id, data);
  return () => repo.remove(id);
}

/**
 * Adds links for a writer that is not a tap: each only when no row has its id – live or removed. One
 * transaction for all. A link that must not be stored (the vault, no link target, malformed) is skipped, not
 * thrown: the callers are copies of data that arrived from elsewhere. Returns how many rows were written.
 */
export async function addLinksIfAbsent(
  links: readonly EntityLink[],
  database: TaschenmesserDB = defaultDb,
): Promise<number> {
  const items = new Map<string, LinkRow>();
  for (const link of links) {
    let data: LinkRow;
    try {
      data = toRow(link);
    } catch {
      continue;
    }
    items.set(await linkId(data as EntityLink), data);
  }
  if (items.size === 0) return 0;
  const created = await linksRepo(database).createMany(
    [...items].map(([id, data]) => ({ id, data })),
  );
  return created.length;
}

/**
 * Adds a link for a writer that is not a tap: only when no row has its id – live or removed. Returns whether
 * a row was written. Same guards as `addLink` (it throws for them).
 */
export async function addLinkIfAbsent(
  link: EntityLink,
  database: TaschenmesserDB = defaultDb,
): Promise<boolean> {
  toRow(link);
  return (await addLinksIfAbsent([link], database)) > 0;
}

/**
 * Removes a link by what it is, also when this device holds no row for it yet. For a link a ToDo carries that
 * matters: its entry may stand only in the task's `links[]` here (the copy has not run, or the row is on
 * another device) – stripping the array alone would leave no tombstone, and the other device's row would bring
 * the link back. So the row is first written the way the copy would (stamped like the task's `links` field)
 * and then removed: the removal is a fact that syncs. One undo of the calling action restores row and entry.
 */
export async function removeLinkOf(
  link: EntityLink,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  let data: LinkRow;
  try {
    data = toRow(link);
  } catch {
    return; // a link that could never be stored has no row to remove
  }
  const id = await linkId(data as EntityLink);
  if (!(await linksRepo(database).table.get(id))) {
    if (link.from.module !== 'todos') return; // nothing stored, nothing to remove
    const todos = getManifest('todos');
    if (!todos?.dataSchema.collections.task) return;
    const task = await createCollectionRepo(todos, 'task', database).table.get(link.from.id);
    if (!task) return;
    await writeStamped([{ id, data, stamp: carrierStamp(task) }], database);
  }
  await removeLink(id, database);
}

/**
 * Removes one link (soft delete: the removal reaches every device). A link a ToDo carries may also stand in
 * the task's own frozen `links[]` field: that entry goes with it (unless another live row still leads to the
 * same target), so the copy of the ToDo links can never bring the link back once the tombstone was purged.
 * Both writes report to the undo journal of the calling action: one undo restores row and entry.
 */
export async function removeLink(id: string, database: TaschenmesserDB = defaultDb): Promise<void> {
  const repo = linksRepo(database);
  const row = await repo.table.get(id);
  await repo.remove(id);
  const link = row && readLink(row);
  if (!link || link.from.module !== 'todos') return;
  const todos = getManifest('todos');
  if (!todos?.dataSchema.collections.task) return;
  const others = await repo.table.where('fromKey').equals(row.fromKey).toArray();
  if (others.some((r) => r.deletedAt === null && r.toKey === row.toKey)) return;
  const tasks = createCollectionRepo(todos, 'task', database);
  const task = await tasks.get(link.from.id);
  const stored = Array.isArray(task?.links) ? (task.links as unknown[]) : [];
  const rest = stored.filter((entry) => {
    const l = entry as Partial<LegacyLink> | null;
    const module = l && typeof l.kind === 'string' ? refOfKind[l.kind] : undefined;
    return !(module === link.to.module && l?.id === link.to.id);
  });
  if (rest.length !== stored.length)
    await tasks.update(link.from.id, { links: rest.length ? rest : undefined });
}

function entries(rows: readonly StoredLink[], key: string): LinkEntry[] {
  const out: LinkEntry[] = [];
  for (const row of rows) {
    if (row.deletedAt !== null) continue;
    const link = readLink(row);
    if (!link) continue;
    const direction = row.fromKey === key ? 'out' : 'in';
    out.push({ id: row.id, link, direction, other: direction === 'out' ? link.to : link.from });
  }
  // Stable order: outgoing first, then by the time the link was made.
  const made = new Map(rows.map((r) => [r.id, r.createdAt]));
  return out.sort(
    (a, b) =>
      (a.direction === b.direction ? 0 : a.direction === 'out' ? -1 : 1) ||
      (made.get(a.id) ?? 0) - (made.get(b.id) ?? 0) ||
      a.id.localeCompare(b.id),
  );
}

/** The live links of a thing in both directions, unresolved (two indexed reads). */
export async function linkEntries(
  ref: EntityRef,
  database: TaschenmesserDB = defaultDb,
): Promise<LinkEntry[]> {
  const key = refKey(ref);
  const table = linksRepo(database).table;
  const [from, to] = await Promise.all([
    table.where('fromKey').equals(key).toArray(),
    table.where('toKey').equals(key).toArray(),
  ]);
  return entries([...from, ...to], key);
}

/** The links of a thing in both directions, the other end resolved through its module. */
export async function linksOf(
  ref: EntityRef,
  database: TaschenmesserDB = defaultDb,
): Promise<ResolvedLink[]> {
  const list = await linkEntries(ref, database);
  return Promise.all(list.map(async (e) => ({ ...e, state: await resolveLink(e.other) })));
}

/** Live `linksOf`; `undefined` while loading. Follows the rows, the targets and the module switches. */
export function useLinks(ref: EntityRef): ResolvedLink[] | undefined {
  const key = refKey(ref);
  const list = useSharedLiveQuery(`entitylinks|${key}`, () => linkEntries(ref));
  const others = useMemo(() => (list ?? []).map((e) => e.other), [list]);
  const states = useResolvedLinks(others);
  return useMemo(() => {
    if (!list || !states) return undefined;
    const out: ResolvedLink[] = [];
    for (const e of list) {
      const state = states.get(refKey(e.other));
      // The states of another set of refs are still shown while this one loads.
      if (!state) return undefined;
      out.push({ ...e, state });
    }
    return out;
  }, [list, states]);
}

/**
 * „Im Plan · Di“: the earliest day from today on that the planner gave the thing – the earliest live
 * `planner_assignment` of `<module>:<id>`. A thing that is no plan item itself has the day of a ToDo linking to
 * it. `undefined` while the planner module is off (or not in this build). A core read through the generic
 * manifest repo, like `modules/mail/planMail.ts` and `quickCapture/targets/lookup.ts`; nothing is written.
 */
export async function plannedDay(
  ref: EntityRef,
  database: TaschenmesserDB = defaultDb,
): Promise<string | undefined> {
  const planner = getManifest('planner');
  if (!planner?.dataSchema.collections.assignment) return undefined;
  if (!(await loadModuleStates(visibleManifests, database)).planner) return undefined;
  const assignments = createCollectionRepo(planner, 'assignment', database);
  const from = today();
  const earliest = async (itemKey: string): Promise<string | undefined> => {
    const rows = await assignments.table.where('itemKey').equals(itemKey).toArray();
    const days = rows
      .filter((r) => r.deletedAt === null && typeof r.date === 'string' && r.date >= from)
      .map((r) => r.date as string)
      .sort();
    return days[0];
  };
  const own = await earliest(refKey(ref));
  if (own) return own;
  // Not a plan item itself: the ToDos that link to it are (a note, a mail thread, an event).
  const days: string[] = [];
  for (const entry of await linkEntries(ref, database)) {
    if (entry.direction !== 'in' || entry.other.module !== 'todos') continue;
    const day = await earliest(refKey(entry.other));
    if (day) days.push(day);
  }
  return days.sort()[0];
}
