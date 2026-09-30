/**
 * Tombstone cleanup. Deleting a synced record keeps a row with `deletedAt` so the deletion reaches
 * other devices. Once it has been synced and is older than the retention period it is removed
 * locally. The retention is long on purpose: a device that was offline for longer than this could
 * bring a deleted record back, so the device list flags devices unseen for that long.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { rwTransaction } from '@/core/db/tx';
import { allManifests } from '@/core/modules/registry';
import { now } from '@/core/time/now';
import type { SyncRow } from './ops';

export const TOMBSTONE_RETENTION_MS = 90 * 24 * 3600_000;

export async function purgeTombstones(
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
  at: number = now(),
  retentionMs: number = TOMBSTONE_RETENTION_MS,
): Promise<number> {
  const cutoff = at - retentionMs;
  let removed = 0;
  for (const name of tableNames) {
    const table = database.table<SyncRow, string>(name);
    const outbox = database.table('_outbox');
    removed += await rwTransaction(database, [table, outbox], async () => {
      const old = await table
        .filter((r) => r.deletedAt !== null && r.deletedAt < cutoff)
        .primaryKeys();
      if (old.length === 0) return 0;
      // A tombstone that was not pushed yet must survive until the server has it.
      const queued = await outbox.bulkGet(old.map((id): [string, string] => [name, id]));
      const purge = old.filter((_id, i) => !queued[i]);
      await table.bulkDelete(purge);
      return purge.length;
    });
  }
  return removed;
}
