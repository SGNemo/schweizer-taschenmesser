/**
 * App migrations: idempotent forward copies of rows from a retired (or merged) collection into a
 * new one, e.g. `shopping_item` → `lists_item`. They are not module migrations (`manifest.migrations`
 * reshape a module's own data per device); an app migration moves data *between* modules and must
 * converge across devices.
 *
 * How a copy is written: not through `createRepo` (it stamps every field with a fresh HLC, so two
 * devices that both migrate would write different stamps and an older edit of the source could
 * lose against the copy), but as field ops with the HLCs of the source row, merged by the same
 * last-write-wins rule as a sync pull (`mergeOps`) and queued for the outbox. Consequences:
 *  - every device produces identical ops for the same source row (fields copied 1:1 keep their
 *    stamp, derived fields get the newest stamp of the row, rows made up by a step use `BASE_HLC`),
 *  - running again changes nothing (equal or older ops lose), so the runner can simply run after
 *    every app start, sync pull and backup import,
 *  - a later edit of the target (newer HLC) always wins; an edit of the source row on a device that
 *    has not updated yet (newer HLC) flows into the target on the next run,
 *  - tombstones are copied too (`deletedAt` is part of the ops); source rows are never removed.
 */
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import type { SyncRow } from '@/core/sync/ops';
import type { FieldOp } from '@/core/sync/types';
import { getDeviceContext } from '@/core/db/device';
import { now } from '@/core/time/now';
import { APP_MIGRATIONS } from './appMigrationSteps';
import { db as defaultDb, type TaschenmesserDB } from './db';
import { syncedTableNames, tableName } from './schema';

/**
 * Stamp of rows that a step makes up itself (e.g. the default list "Einkauf"). It is older than any
 * real edit, identical on every device and a valid HLC, so creating it twice is a no-op and the
 * user's own changes always win.
 */
export const BASE_HLC = '0000000000001-0000-migrate';

export interface MappedRow {
  /** Id of the target row (usually the source id). */
  id: string;
  /** Data fields of the target (validated against the target collection's schema). */
  fields: Record<string, unknown>;
  /** Target field → source field it was copied from (takes that field's stamp). Same name is the default. */
  from?: Record<string, string>;
}

export interface AppMigration {
  /** Stable id (also the `_meta` key `app.migrations.<id>`). */
  id: string;
  /** Source table, e.g. `tableName('shopping', 'item')`. */
  source: string;
  /** Target table; a step is skipped silently when it is not part of the schema. */
  target: string;
  /** Maps one source row; `undefined` skips it. */
  map(row: SyncRow): MappedRow | undefined;
  /** Rows the step needs first, e.g. a default list in another table (made up, stamped with `BASE_HLC`). */
  ensure?: () => { table: string; id: string; fields: Record<string, unknown> }[];
}

export interface MigrationReport {
  id: string;
  scanned: number;
  /** Rows that actually changed the target in this run. */
  copied: number;
  /** Source rows the step skipped or that did not fit the target schema. */
  skipped: number;
}

const META_PREFIX = 'app.migrations.';
const newest = (row: SyncRow): string =>
  Object.values(row._f).reduce((a, b) => (b > a ? b : a), BASE_HLC);

function targetSchema(target: string) {
  for (const m of allManifests)
    for (const [name, def] of Object.entries(m.dataSchema.collections))
      if (tableName(m.id, name) === target) return def.schema;
  return undefined;
}

/** The field ops that a step produces for one source row. */
export function opsFor(step: AppMigration, source: SyncRow, stamp?: string): FieldOp[] | undefined {
  const mapped = step.map(source);
  const schema = targetSchema(step.target);
  if (!mapped || !schema) return undefined;
  const parsed = schema.safeParse(mapped.fields);
  if (!parsed.success) return undefined;
  const data = parsed.data as Record<string, unknown>;
  const fallback = newest(source);
  const ops: FieldOp[] = Object.entries(data)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => ({
      collection: step.target,
      id: mapped.id,
      field,
      hlc: stamp ?? source._f[mapped.from?.[field] ?? field] ?? fallback,
      value,
    }));
  ops.push({
    collection: step.target,
    id: mapped.id,
    field: 'deletedAt',
    hlc: stamp ?? source._f.deletedAt ?? fallback,
    value: source.deletedAt,
  });
  return ops;
}

function ensureOps(step: AppMigration, known: ReadonlySet<string>, stamp?: string): FieldOp[] {
  if (!step.ensure) return [];
  return step.ensure().flatMap((row) => {
    const schema = known.has(row.table) ? targetSchema(row.table) : undefined;
    const parsed = schema?.safeParse(row.fields);
    if (!parsed?.success) return [];
    return [
      ...Object.entries(parsed.data as Record<string, unknown>)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => ({
          collection: row.table,
          id: row.id,
          field,
          hlc: stamp ?? BASE_HLC,
          value,
        })),
      {
        collection: row.table,
        id: row.id,
        field: 'deletedAt',
        hlc: stamp ?? BASE_HLC,
        value: null,
      },
    ];
  });
}

/** Runs one step; never throws for missing tables or bad rows. */
export async function runStep(
  step: AppMigration,
  database: TaschenmesserDB,
  storage: DexieStorageAdapter,
  known: ReadonlySet<string>,
  /** Hands out fresh stamps instead of the source stamps (after a "replace" restore, see `runAppMigrations`). */
  fresh?: () => string,
): Promise<MigrationReport> {
  const report: MigrationReport = { id: step.id, scanned: 0, copied: 0, skipped: 0 };
  if (!known.has(step.target) || !database.tables.some((t) => t.name === step.source))
    return report;
  const rows = await database.table<SyncRow, string>(step.source).toArray();
  report.scanned = rows.length;
  if (rows.length === 0) return report;
  const ops: FieldOp[] = ensureOps(step, known, fresh?.());
  for (const row of rows) {
    const rowOps = opsFor(step, row, fresh?.());
    if (rowOps) ops.push(...rowOps);
    else report.skipped++;
  }
  const applied = await storage.applyRemote(ops, { markDirty: true });
  report.copied = applied.records;
  await database
    .table<{ key: string; value: unknown }, string>('_meta')
    .put({ key: META_PREFIX + step.id, value: { at: now(), scanned: report.scanned } });
  return report;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Runs all app migrations. Safe to call at any time and as often as wanted; calls are serialised
 * so a sync pull and a backup import never copy at the same time. Errors are swallowed (the next
 * run retries): a failing migration must not break app start, sync or restore.
 */
export function runAppMigrations(
  database: TaschenmesserDB = defaultDb,
  opts: { tableNames?: string[]; steps?: readonly AppMigration[]; restamp?: boolean } = {},
): Promise<MigrationReport[]> {
  const run = async (): Promise<MigrationReport[]> => {
    const known = new Set(opts.tableNames ?? syncedTableNames(allManifests));
    const storage = new DexieStorageAdapter(database, [...known]);
    const reports: MigrationReport[] = [];
    // After a "replace" restore the backup is the truth again: the copies are written like the restored
    // rows themselves (fresh stamps), so they beat the tombstones the restore left in the target.
    const fresh = opts.restamp ? (await getDeviceContext(database)).clock : undefined;
    for (const step of opts.steps ?? APP_MIGRATIONS) {
      try {
        reports.push(await runStep(step, database, storage, known, fresh && (() => fresh.tick())));
      } catch {
        // Retried on the next run.
      }
    }
    return reports;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}
