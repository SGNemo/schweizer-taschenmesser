/**
 * Applies a backup in ONE Dexie transaction (all tables + the outbox), so a failure or an abort
 * leaves the database exactly as it was: never a half-restored state. Also computes the restore
 * preview (what is added, replaced, removed) without writing anything.
 *
 * Inside the transaction only Dexie operations are awaited (see CLAUDE.md); the device context is
 * loaded before it starts.
 */
import type { TaschenmesserDB } from '@/core/db/db';
import { getDeviceContext } from '@/core/db/device';
import { maxHlc } from '@/core/db/hlc';
import { rwTransaction } from '@/core/db/tx';
import { mergeOps, recordToOps, type SyncRow } from '@/core/sync/ops';
import type { FieldOp } from '@/core/sync/types';
import { now } from '@/core/time/now';
import type { Backup, ImportMode, ImportSummary } from './backup';

export interface ApplyHooks {
  /** Called synchronously after each table was written, still inside the transaction. Tests only. */
  afterTable?(name: string): void;
}

interface OutboxRow {
  collection: string;
  id: string;
  rev: number;
  queuedAt: number;
}

/** "todos_task" → "todos"; system tables (`_settings`, `_modules`) → "core". */
export function moduleOfTable(name: string): string {
  return name.startsWith('_') ? 'core' : name.split('_')[0]!;
}

function knownTables(backup: Backup, tableNames: string[]) {
  const known = new Set(tableNames);
  const tables: [string, SyncRow[]][] = [];
  let skipped = 0;
  for (const [name, rows] of Object.entries(backup.tables)) {
    if (known.has(name)) tables.push([name, rows]);
    else skipped++;
  }
  return { tables, skipped };
}

export async function applyBackup(
  backup: Backup,
  mode: ImportMode,
  database: TaschenmesserDB,
  tableNames: string[],
  hooks: ApplyHooks = {},
): Promise<ImportSummary> {
  const { tables, skipped } = knownTables(backup, tableNames);
  const summary: ImportSummary = { records: 0, removed: 0, skippedTables: skipped };
  if (tables.length === 0) return summary;

  const { deviceId, clock } = await getDeviceContext(database);
  const outbox = database.table<OutboxRow, [string, string]>('_outbox');
  const scope = [...tables.map(([name]) => database.table(name)), outbox];

  await rwTransaction(database, scope, async () => {
    for (const [name, rows] of tables) {
      const table = database.table<SyncRow, string>(name);
      const changed = new Map<string, SyncRow>();

      if (mode === 'merge') {
        const existing = await table.bulkGet(rows.map((r) => r.id));
        rows.forEach((row, i) => {
          const merged = mergeOps(existing[i], row.id, recordToOps(name, row));
          if (merged.changed) changed.set(row.id, merged.row);
        });
        summary.records += rows.length;
      } else {
        const existing = await table.toArray();
        // Fresh stamps must beat everything already stored, even stamps this session has not seen.
        const newest = maxHlc(existing.flatMap((r) => Object.values(r._f)));
        if (newest) clock.receive(newest);

        const inBackup = new Set(rows.map((r) => r.id));
        for (const r of existing) {
          if (r.deletedAt !== null || inBackup.has(r.id)) continue;
          const ts = now();
          changed.set(r.id, {
            ...r,
            deletedAt: ts,
            updatedAt: ts,
            deviceId,
            _f: { ...r._f, deletedAt: clock.tick() },
          });
          summary.removed++;
        }

        const byId = new Map(existing.map((r) => [r.id, r]));
        for (const row of rows) {
          const stamp = clock.tick();
          const fields = new Set(Object.keys(row._f));
          fields.add('deletedAt');
          // Fields the record has locally but the backup does not have are removed.
          for (const field of Object.keys(byId.get(row.id)?._f ?? {})) fields.add(field);
          const ops: FieldOp[] = [...fields].map((field) => ({
            collection: name,
            id: row.id,
            field,
            hlc: stamp,
            value: field === 'deletedAt' ? (row.deletedAt ?? null) : (row[field] ?? null),
          }));
          changed.set(row.id, mergeOps(byId.get(row.id), row.id, ops).row);
          summary.records++;
        }
      }

      if (changed.size > 0) {
        const ids = [...changed.keys()];
        await table.bulkPut([...changed.values()]);
        const previous = await outbox.bulkGet(ids.map((id): [string, string] => [name, id]));
        const queuedAt = now();
        await outbox.bulkPut(
          ids.map((id, i) => ({
            collection: name,
            id,
            queuedAt,
            rev: (previous[i]?.rev ?? 0) + 1,
          })),
        );
      }
      hooks.afterTable?.(name);
    }
  });
  return summary;
}

/* --------------------------------------- preview --------------------------------------- */

export interface ModuleChange {
  module: string;
  /** In the backup, not on this device. */
  added: number;
  /** On both, but the backup differs (merge: only where the backup is newer). */
  replaced: number;
  /** On this device, not in the backup (replace mode only). */
  removed: number;
  unchanged: number;
}

export interface RestorePlan {
  mode: ImportMode;
  modules: ModuleChange[];
  totals: Omit<ModuleChange, 'module'>;
  skippedTables: number;
}

const stampsOf = (r: SyncRow): string =>
  JSON.stringify(Object.entries(r._f).sort(([a], [b]) => a.localeCompare(b)));

/** What a restore would do, computed without writing anything. */
export async function planRestore(
  backup: Backup,
  mode: ImportMode,
  database: TaschenmesserDB,
  tableNames: string[],
): Promise<RestorePlan> {
  const { tables, skipped } = knownTables(backup, tableNames);
  const byModule = new Map<string, ModuleChange>();
  const entry = (name: string): ModuleChange => {
    const module = moduleOfTable(name);
    let e = byModule.get(module);
    if (!e) byModule.set(module, (e = { module, added: 0, replaced: 0, removed: 0, unchanged: 0 }));
    return e;
  };

  for (const [name, rows] of tables) {
    const e = entry(name);
    const existing = await database.table<SyncRow, string>(name).toArray();
    const byId = new Map(existing.map((r) => [r.id, r]));
    for (const row of rows) {
      const local = byId.get(row.id);
      if (!local) e.added++;
      else if (
        mode === 'merge'
          ? mergeOps(local, row.id, recordToOps(name, row)).changed
          : stampsOf(local) !== stampsOf(row)
      )
        e.replaced++;
      else e.unchanged++;
    }
    if (mode === 'replace') {
      const inBackup = new Set(rows.map((r) => r.id));
      e.removed += existing.filter((r) => r.deletedAt === null && !inBackup.has(r.id)).length;
    }
  }

  const modules = [...byModule.values()].sort((a, b) => a.module.localeCompare(b.module));
  const totals = { added: 0, replaced: 0, removed: 0, unchanged: 0 };
  for (const m of modules) {
    totals.added += m.added;
    totals.replaced += m.replaced;
    totals.removed += m.removed;
    totals.unchanged += m.unchanged;
  }
  return { mode, modules, totals, skippedTables: skipped };
}
