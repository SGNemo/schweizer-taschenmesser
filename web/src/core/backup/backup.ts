import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getDeviceContext } from '@/core/db/device';
import { maxHlc } from '@/core/db/hlc';
import { createRepo } from '@/core/db/repo';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import type { StorageAdapter } from '@/core/storage/types';
import { recordToOps, type SyncRow } from '@/core/sync/ops';
import type { FieldOp } from '@/core/sync/types';

export const BACKUP_FORMAT = 'taschenmesser-backup';
export const BACKUP_VERSION = 1;

const HLC_RE = /^\d{13}-\d{4}-[a-z0-9]{1,32}$/;

const rowSchema = z.looseObject({
  id: z.string().min(1),
  deletedAt: z.number().nullable(),
  _f: z.record(z.string().min(1), z.string().regex(HLC_RE)),
});

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(rowSchema)),
});

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Raw rows including tombstones and per-field stamps. */
  tables: Record<string, SyncRow[]>;
}

export type ParseResult =
  | { ok: true; backup: Backup }
  | { ok: false; reason: 'not-json' | 'wrong-format' | 'newer-version' | 'invalid' };

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  /** Records written from the backup. */
  records: number;
  /** Records deleted because the backup does not contain them (replace only). */
  removed: number;
  /** Tables in the file that this app version does not know. */
  skippedTables: number;
}

/**
 * Snapshot of all synced data (module data, module states, settings). Device-local data such as
 * the sync token, the encryption key or an API key is never included.
 */
export async function createBackup(
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
  exportedAt: Date = new Date(),
): Promise<Backup> {
  const tables: Record<string, SyncRow[]> = {};
  for (const name of tableNames)
    tables[name] = await database.table<SyncRow, string>(name).toArray();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    tables,
  };
}

export const serializeBackup = (backup: Backup): string => JSON.stringify(backup);

export function backupFileName(date: Date = new Date()): string {
  return `taschenmesser-backup-${date.toISOString().slice(0, 10)}.json`;
}

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'not-json' };
  }
  if (
    typeof json !== 'object' ||
    json === null ||
    (json as { format?: unknown }).format !== BACKUP_FORMAT
  ) {
    return { ok: false, reason: 'wrong-format' };
  }
  const version = (json as { version?: unknown }).version;
  if (typeof version === 'number' && version > BACKUP_VERSION)
    return { ok: false, reason: 'newer-version' };
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  return { ok: true, backup: parsed.data as unknown as Backup };
}

/**
 * Restores a backup.
 *  - merge:   field-level last-write-wins against the current data (same rule as sync), nothing is
 *             deleted. Everything that changed is queued for sync.
 *  - replace: the backup becomes the truth. Records that are not in the backup are deleted
 *             (tombstones) and every backup record is written as a fresh edit, so the restore also
 *             wins against other devices when sync pushes it. Tables missing from the file are kept.
 */
export async function importBackup(
  backup: Backup,
  mode: ImportMode,
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
  storage: StorageAdapter = new DexieStorageAdapter(database, tableNames),
): Promise<ImportSummary> {
  const known = new Set(tableNames);
  const summary: ImportSummary = { records: 0, removed: 0, skippedTables: 0 };
  const tables = Object.entries(backup.tables).filter(([name]) => {
    if (known.has(name)) return true;
    summary.skippedTables++;
    return false;
  });

  if (mode === 'merge') {
    const ops = tables.flatMap(([name, rows]) => rows.flatMap((row) => recordToOps(name, row)));
    for (const [, rows] of tables) summary.records += rows.length;
    await storage.applyRemote(ops, { markDirty: true });
    return summary;
  }

  const { clock } = await getDeviceContext(database);
  const ops: FieldOp[] = [];
  for (const [name, rows] of tables) {
    const table = database.table<SyncRow, string>(name);
    const existing = await table.toArray();
    // Fresh stamps must beat everything already stored, even stamps this session has not seen.
    const newest = maxHlc(existing.flatMap((r) => Object.values(r._f)));
    if (newest) clock.receive(newest);

    const inBackup = new Set(rows.map((r) => r.id));
    const gone = existing
      .filter((r) => r.deletedAt === null && !inBackup.has(r.id))
      .map((r) => r.id);
    if (gone.length) {
      await createRepo(name, z.looseObject({}), database).removeMany(gone);
      summary.removed += gone.length;
    }

    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const row of rows) {
      const stamp = clock.tick();
      const fields = new Set(Object.keys(row._f));
      fields.add('deletedAt');
      // Fields the record has locally but the backup does not have are removed.
      for (const field of Object.keys(byId.get(row.id)?._f ?? {})) fields.add(field);
      for (const field of fields) {
        ops.push({
          collection: name,
          id: row.id,
          field,
          hlc: stamp,
          value: field === 'deletedAt' ? (row.deletedAt ?? null) : (row[field] ?? null),
        });
      }
      summary.records++;
    }
  }
  await storage.applyRemote(ops, { markDirty: true });
  return summary;
}
