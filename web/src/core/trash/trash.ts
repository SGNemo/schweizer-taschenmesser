/**
 * "Zuletzt gelöscht": lists what was deleted lately (tombstones inside the window), restores it
 * and removes it for good. Only an allow-list of collections takes part; the password vault
 * (`accounts`) never does. Restoring is a normal repo write (a field op that syncs like any edit);
 * removing for good is the same local clean-up `purgeTombstones` does after 90 days.
 */
import { z } from 'zod';
import { deleteBlob } from '@/core/blobs';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { isRestorable } from '@/core/db/trash';
import { formatMoney } from '@/core/money';
import { loadSyncConfig } from '@/core/sync/service';
import { formatDay } from '@/core/time/dates';
import { now } from '@/core/time/now';
import { trashRetentionMs } from './settings';

export type TrashKind =
  | 'document'
  | 'subscription'
  | 'event'
  | 'reminder'
  | 'todo'
  | 'note'
  | 'bookmark'
  | 'list'
  | 'pantry'
  | 'person'
  | 'gift'
  | 'invoice'
  | 'budget'
  | 'goal'
  | 'account'
  | 'booking'
  | 'habit'
  | 'session';

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
/** First non-empty line of a text, for records without a real title (a note with only a body). */
const firstLine = (v: unknown): string =>
  str(v)
    .split('\n')
    .find((l) => l.trim() !== '')
    ?.trim() ?? '';

interface TrashCollection {
  table: string;
  title: (row: Record<string, unknown>) => string;
  kind: (row: Record<string, unknown>) => TrashKind;
  /** Extra clean-up when the record is removed for good. */
  onPurge?: (id: string) => Promise<void>;
  /**
   * Rows of another table that are deleted together with this record (an account's bookings, a
   * habit's days): restored with it. A child row is listed on its own only while its parent is active.
   */
  children?: { table: string; parentKey: string };
  /** Rows that are never offered (imported or automatically booked data). */
  skip?: (row: Record<string, unknown>) => boolean;
  /** Rows sharing a value of this field are one entry (both halves of a transfer): listed once, restored together. */
  group?: string;
}

/** Children deleted up to this long before their parent count as deleted together with it. */
const TOGETHER_MS = 60_000;

/**
 * The collections that show up in "Zuletzt gelöscht": what people create by hand. Passwords
 * (`accounts`) never do; neither do bulk or derived data (imported bank transactions, automatic
 * bookings, list items, caches).
 */
export const TRASH_COLLECTIONS: readonly TrashCollection[] = [
  {
    table: 'vault_document',
    title: (r) => String(r.title ?? ''),
    kind: () => 'document',
    onPurge: (id) => deleteBlob(id),
  },
  {
    table: 'subscriptions_subscription',
    title: (r) => String(r.name ?? ''),
    kind: () => 'subscription',
  },
  { table: 'todos_task', title: (r) => str(r.title), kind: () => 'todo' },
  {
    table: 'notes_note',
    title: (r) => str(r.title).trim() || firstLine(r.body),
    kind: () => 'note',
  },
  { table: 'bookmarks_item', title: (r) => str(r.title), kind: () => 'bookmark' },
  { table: 'lists_list', title: (r) => str(r.name), kind: () => 'list' },
  { table: 'pantry_item', title: (r) => str(r.name), kind: () => 'pantry' },
  { table: 'people_person', title: (r) => str(r.name), kind: () => 'person' },
  { table: 'people_gift', title: (r) => str(r.title), kind: () => 'gift' },
  { table: 'invoices_invoice', title: (r) => str(r.payee), kind: () => 'invoice' },
  { table: 'budgets_budget', title: (r) => str(r.name), kind: () => 'budget' },
  { table: 'budgets_goal', title: (r) => str(r.name), kind: () => 'goal' },
  {
    table: 'calendar_event',
    title: (r) => String(r.title ?? ''),
    kind: (r) => (r.kind === 'reminder' ? 'reminder' : 'event'),
  },
  {
    table: 'finance_account',
    title: (r) => str(r.name),
    kind: () => 'account',
    children: { table: 'finance_transaction', parentKey: 'accountId' },
  },
  {
    table: 'finance_transaction',
    title: (r) =>
      str(r.payee).trim() ||
      str(r.note).trim() ||
      formatMoney(typeof r.amountMinor === 'number' ? r.amountMinor : 0),
    kind: () => 'booking',
    // Bank imports (`imp-…` ids) and bookings made by other modules stay out, as before.
    skip: (r) => String(r.id).startsWith('imp-') || r.sourceRef !== undefined,
    group: 'transferId',
  },
  {
    table: 'habits_goal',
    title: (r) => str(r.name),
    kind: () => 'habit',
    children: { table: 'habits_entry', parentKey: 'goalId' },
  },
  {
    table: 'timetrack_session',
    title: (r) =>
      str(r.note).trim() || `${formatDay(str(r.date), 'd. MMM yyyy')} ${str(r.startTime)}`,
    kind: () => 'session',
  },
];

export interface TrashEntry {
  table: string;
  id: string;
  title: string;
  kind: TrashKind;
  deletedAt: number;
  /** Whole days left in the window (at least 1 while it can be restored). */
  daysLeft: number;
}

const QUEUE_KEY = 'trash.queued';
const DAY_MS = 24 * 3600_000;

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

async function readQueue(database: TaschenmesserDB): Promise<string[]> {
  const row = await meta(database).get(QUEUE_KEY);
  return Array.isArray(row?.value) ? (row.value as string[]) : [];
}
const writeQueue = (database: TaschenmesserDB, value: string[]) =>
  meta(database).put({ key: QUEUE_KEY, value });

const keyOf = (table: string, id: string) => `${table}|${id}`;

/** Deleted records inside the window, newest deletion first; ones waiting to be removed are hidden. */
export async function listTrash(
  database: TaschenmesserDB = defaultDb,
  at: number = now(),
  retentionMs?: number,
): Promise<TrashEntry[]> {
  const window = retentionMs ?? (await trashRetentionMs());
  const queued = new Set(await readQueue(database));
  // Child rows (an account's bookings) are only offered on their own while their parent is active.
  const activeParents = new Map<string, { key: string; ids: Set<string> }>();
  for (const c of TRASH_COLLECTIONS) {
    if (!c.children) continue;
    const ids = (await database
      .table<{ id: string; deletedAt: number | null }, string>(c.table)
      .filter((r) => r.deletedAt === null)
      .primaryKeys()) as string[];
    activeParents.set(c.children.table, { key: c.children.parentKey, ids: new Set(ids) });
  }
  const out: TrashEntry[] = [];
  for (const c of TRASH_COLLECTIONS) {
    const parents = activeParents.get(c.table);
    const rows = await database
      .table<Record<string, unknown> & { id: string; deletedAt: number | null }, string>(c.table)
      .filter((r) => isRestorable(r.deletedAt, at, window))
      .toArray();
    const groups = new Set<unknown>();
    for (const r of rows) {
      if (queued.has(keyOf(c.table, r.id))) continue;
      if (c.skip?.(r)) continue;
      if (parents && !parents.ids.has(String(r[parents.key]))) continue;
      const group = c.group ? r[c.group] : undefined;
      if (group !== undefined && group !== null) {
        if (groups.has(group)) continue;
        groups.add(group);
      }
      const deletedAt = r.deletedAt as number;
      out.push({
        table: c.table,
        id: r.id,
        title: c.title(r),
        kind: c.kind(r),
        deletedAt,
        daysLeft: Math.max(1, Math.ceil((deletedAt + window - at) / DAY_MS)),
      });
    }
  }
  return out.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** The other rows of a group (the other half of a transfer) deleted together with `row`. */
async function groupMates(
  database: TaschenmesserDB,
  c: TrashCollection,
  row: Record<string, unknown> | undefined,
): Promise<string[]> {
  const group = c.group ? row?.[c.group] : undefined;
  const deletedAt = row?.deletedAt;
  if (group === undefined || group === null || typeof deletedAt !== 'number') return [];
  return (await database
    .table<Record<string, unknown> & { id: string }, string>(c.table)
    .filter(
      (r) =>
        r.id !== row!.id &&
        r[c.group!] === group &&
        typeof r.deletedAt === 'number' &&
        Math.abs(r.deletedAt - deletedAt) <= TOGETHER_MS,
    )
    .primaryKeys()) as string[];
}

/** Brings a record back (a repo write, so it syncs and can be undone with Ctrl+Z). */
export async function restoreEntry(
  entry: Pick<TrashEntry, 'table' | 'id'>,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const c = TRASH_COLLECTIONS.find((x) => x.table === entry.table);
  if (!c) throw new Error(`${entry.table} is not part of "Zuletzt gelöscht"`);
  const repo = createRepo(entry.table, z.looseObject({}), database);
  const row = (await repo.table.get(entry.id)) as Record<string, unknown> | undefined;
  const deletedAt = row?.deletedAt;
  const mates = await groupMates(database, c, row);
  await repo.restore(entry.id);
  for (const id of mates) await repo.restore(id); // the other half of a transfer
  if (typeof deletedAt !== 'number' || !c.children) return;
  // The rows deleted together with it (`deleteAccount` removes the bookings first, then the account).
  const { table, parentKey } = c.children;
  const kids = createRepo(table, z.looseObject({}), database);
  const ids = (await kids.table
    .filter(
      (r) =>
        (r as Record<string, unknown>)[parentKey] === entry.id &&
        typeof r.deletedAt === 'number' &&
        r.deletedAt >= deletedAt - TOGETHER_MS &&
        r.deletedAt <= deletedAt,
    )
    .primaryKeys()) as string[];
  for (const id of ids) await kids.restore(id);
}

/**
 * Removes a deleted record locally. When a sync server is set up and the deletion has not reached it
 * yet, the row must stay until it has (otherwise other devices would never learn of the deletion):
 * it is hidden and removed by the next `flushPurgeQueue`.
 */
async function purgeNow(
  database: TaschenmesserDB,
  c: TrashCollection,
  id: string,
  syncOn: boolean,
): Promise<boolean> {
  const outbox = database.table('_outbox');
  if (syncOn && (await outbox.get([c.table, id]))) return false;
  await database.table(c.table).delete(id);
  await outbox.delete([c.table, id]);
  await c.onPurge?.(id);
  return true;
}

/** Removes entries that were waiting for the sync server. Returns how many are still waiting. */
export async function flushPurgeQueue(database: TaschenmesserDB = defaultDb): Promise<number> {
  const queue = await readQueue(database);
  if (queue.length === 0) return 0;
  const syncOn = (await loadSyncConfig(database)) !== undefined;
  const left: string[] = [];
  for (const k of queue) {
    const [table, id] = k.split('|') as [string, string];
    const c = TRASH_COLLECTIONS.find((x) => x.table === table);
    if (!c || !(await purgeNow(database, c, id, syncOn))) left.push(k);
  }
  await writeQueue(database, left);
  return left.length;
}

/** "Endgültig löschen". Returns false when it waits for the next sync. */
export async function purgeEntry(
  entry: Pick<TrashEntry, 'table' | 'id'>,
  database: TaschenmesserDB = defaultDb,
): Promise<boolean> {
  const c = TRASH_COLLECTIONS.find((x) => x.table === entry.table);
  if (!c) throw new Error(`${entry.table} is not part of "Zuletzt gelöscht"`);
  const syncOn = (await loadSyncConfig(database)) !== undefined;
  // The other half of a transfer goes with it, otherwise it would show up as a new entry.
  const mates = await groupMates(database, c, await database.table(c.table).get(entry.id));
  const waiting: string[] = [];
  for (const id of [entry.id, ...mates])
    if (!(await purgeNow(database, c, id, syncOn))) waiting.push(keyOf(c.table, id));
  if (waiting.length === 0) return true;
  await writeQueue(database, [...(await readQueue(database)), ...waiting]);
  return false;
}
