/**
 * Conflict log. Last-write-wins keeps one value per field; when a remote edit meets a local edit
 * that was not synced yet, the losing value would silently disappear. It is logged here (local only,
 * never synced or exported) so the user can see where LWW decided and restore the overwritten value.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getDeviceContext } from '@/core/db/device';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { now } from '@/core/time/now';
import type { SyncRow } from './ops';

export * from './conflictLog';
import type { ConflictRow, ConflictStatus } from './conflictLog';
import { MAX_CONFLICT_ROWS, OPEN_KEEP_MS, RESOLVED_KEEP_MS } from './conflictLog';

const table = (database: TaschenmesserDB) => database.table<ConflictRow, number>('_conflicts');

export async function listConflicts(
  database: TaschenmesserDB = defaultDb,
  status: ConflictStatus = 'open',
): Promise<ConflictRow[]> {
  const rows = await table(database).where('status').equals(status).toArray();
  return rows.sort((a, b) => b.at - a.at);
}

export const countOpenConflicts = (database: TaschenmesserDB = defaultDb): Promise<number> =>
  table(database).where('status').equals('open').count();

export async function dismissConflict(
  id: number,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await table(database).update(id, { status: 'dismissed' });
}

export async function dismissAllConflicts(database: TaschenmesserDB = defaultDb): Promise<void> {
  await table(database).where('status').equals('open').modify({ status: 'dismissed' });
}

export type RestoreOutcome = 'restored' | 'already-current' | 'record-gone' | 'not-restorable';

/**
 * Writes the overwritten value back as a fresh edit (it wins against everything seen so far and
 * syncs to the other devices). Nothing is lost: the value the user replaces is logged in turn, so a
 * mistaken restore can be undone the same way.
 */
export async function restoreConflict(
  id: number,
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
): Promise<RestoreOutcome> {
  const row = await table(database).get(id);
  if (!row || row.truncated || !tableNames.includes(row.collection)) return 'not-restorable';
  const record = await database.table<SyncRow, string>(row.collection).get(row.recordId);
  if (!record) {
    await table(database).update(id, { status: 'dismissed' });
    return 'record-gone';
  }
  const current = row.field === 'deletedAt' ? record.deletedAt : (record[row.field] ?? null);
  if (JSON.stringify(current) === JSON.stringify(row.lostValue ?? null)) {
    await table(database).update(id, { status: 'restored' });
    return 'already-current';
  }
  const { clock } = await getDeviceContext(database);
  const stamp = record._f[row.field];
  if (stamp) clock.receive(stamp);
  const storage = new DexieStorageAdapter(database, tableNames);
  await storage.applyRemote(
    [
      {
        collection: row.collection,
        id: row.recordId,
        field: row.field,
        hlc: clock.tick(),
        value: row.lostValue ?? null,
      },
    ],
    { markDirty: true },
  );
  await table(database).update(id, { status: 'restored' });
  return 'restored';
}

/** Drops resolved entries after 30 days, open ones after 90, and keeps at most 500 rows. */
export async function purgeConflicts(
  database: TaschenmesserDB = defaultDb,
  at: number = now(),
): Promise<number> {
  const rows = await table(database).toArray();
  const stale = rows.filter(
    (r) => at - r.at > (r.status === 'open' ? OPEN_KEEP_MS : RESOLVED_KEEP_MS),
  );
  const kept = rows.filter((r) => !stale.includes(r)).sort((a, b) => b.at - a.at);
  const overflow = kept.slice(MAX_CONFLICT_ROWS);
  const ids = [...stale, ...overflow].map((r) => r.id!);
  await table(database).bulkDelete(ids);
  return ids.length;
}
