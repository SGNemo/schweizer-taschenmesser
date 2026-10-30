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
import { loadSyncConfig } from '@/core/sync/service';
import { now } from '@/core/time/now';
import { trashRetentionMs } from './settings';

export type TrashKind = 'document' | 'subscription' | 'event' | 'reminder';

interface TrashCollection {
  table: string;
  title: (row: Record<string, unknown>) => string;
  kind: (row: Record<string, unknown>) => TrashKind;
  /** Extra clean-up when the record is removed for good. */
  onPurge?: (id: string) => Promise<void>;
}

/** The collections that show up in "Zuletzt gelöscht". Passwords never do. */
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
  {
    table: 'calendar_event',
    title: (r) => String(r.title ?? ''),
    kind: (r) => (r.kind === 'reminder' ? 'reminder' : 'event'),
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
  const out: TrashEntry[] = [];
  for (const c of TRASH_COLLECTIONS) {
    const rows = await database
      .table<Record<string, unknown> & { id: string; deletedAt: number | null }, string>(c.table)
      .filter((r) => isRestorable(r.deletedAt, at, window))
      .toArray();
    for (const r of rows) {
      if (queued.has(keyOf(c.table, r.id))) continue;
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

/** Brings a record back (a repo write, so it syncs and can be undone with Ctrl+Z). */
export async function restoreEntry(entry: Pick<TrashEntry, 'table' | 'id'>): Promise<void> {
  if (!TRASH_COLLECTIONS.some((c) => c.table === entry.table)) {
    throw new Error(`${entry.table} is not part of "Zuletzt gelöscht"`);
  }
  await createRepo(entry.table, z.looseObject({})).restore(entry.id);
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
  if (await purgeNow(database, c, entry.id, syncOn)) return true;
  await writeQueue(database, [...(await readQueue(database)), keyOf(c.table, entry.id)]);
  return false;
}
