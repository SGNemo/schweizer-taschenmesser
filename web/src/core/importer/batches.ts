/** Batch bookkeeping, the write step and "Import rückgängig machen". Local only (`_imports`). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import type { AiActionHandler, ModuleManifest } from '@/core/modules/types';
import { now } from '@/core/time/now';
import { ImportError } from './plan';
import { deepEqual } from '@/core/db/util';
import type { BatchStatus, BatchUpdate, ImportBatch, PreviewRow } from './types';

const table = (database: TaschenmesserDB) => database.table<ImportBatch, string>('_imports');

export function newBatchId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12);
}

/**
 * Writes the ticked rows of the preview – one `createMany` per collection, then the changes of
 * existing records – and records the batch. Ids are `imp-<batch>-<n>` unless the candidate fixes
 * one, so a repeated commit is idempotent. A change is skipped (and counted as conflict) when the
 * record was edited since the preview, so nothing is overwritten silently.
 */
export async function commitImport(
  manifest: ModuleManifest,
  args: {
    batchId: string;
    importerId: string;
    source: string;
    rows: PreviewRow[];
    /** Fields of an existing (pending) batch row to keep. */
    base?: Partial<ImportBatch>;
    /** Module logic for updates that carry `update.via` (assistant transitions). */
    handlers?: Record<string, AiActionHandler>;
  },
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch> {
  const chosen = args.rows.filter((r) => r.selected && !r.invalid);
  if (chosen.length === 0) throw new ImportError('nothing-selected');

  const byCollection = new Map<string, { data: Record<string, unknown>; id: string }[]>();
  const changes = chosen.filter((r) => r.candidate.update && r.candidate.id);
  const removals = chosen.filter((r) => r.candidate.remove && r.candidate.id);
  chosen.forEach((row, n) => {
    if (row.candidate.update || row.candidate.remove) return;
    const list = byCollection.get(row.candidate.collection) ?? [];
    list.push({
      data: row.candidate.data,
      id: row.candidate.id ?? `imp-${args.batchId}-${n}`,
    });
    byCollection.set(row.candidate.collection, list);
  });

  const records: ImportBatch['records'] = [];
  for (const [collection, items] of byCollection) {
    const def = manifest.dataSchema.collections[collection];
    if (!def) throw new ImportError('unknown-collection');
    const repo = createCollectionRepo(manifest, collection, database);
    const written = await repo.createMany(items);
    records.push({ collection, ids: written.map((r) => r.id) });
  }

  const updates: BatchUpdate[] = [];
  let conflicts = 0;
  for (const row of changes) {
    const { collection } = row.candidate;
    const { before, after } = row.candidate.update!;
    if (!manifest.dataSchema.collections[collection]) throw new ImportError('unknown-collection');
    const repo = createCollectionRepo(manifest, collection, database);
    const current = await repo.get(row.candidate.id!);
    const unchanged =
      current !== undefined && Object.keys(before).every((k) => deepEqual(current[k], before[k]));
    if (!unchanged) {
      conflicts++;
      continue;
    }
    const via = row.candidate.update!.via;
    const handler = via ? args.handlers?.[via] : undefined;
    if (handler) await handler.apply(current.id, after);
    else await repo.update(current.id, after);
    updates.push({ collection, id: current.id, before, after, ...(via ? { via } : {}) });
  }

  const deletes: NonNullable<ImportBatch['deletes']> = [];
  for (const row of removals) {
    const { collection } = row.candidate;
    if (!manifest.dataSchema.collections[collection]) throw new ImportError('unknown-collection');
    const repo = createCollectionRepo(manifest, collection, database);
    const current = await repo.get(row.candidate.id!);
    const before = row.candidate.remove!.before;
    const unchanged =
      current !== undefined && Object.keys(before).every((k) => deepEqual(current[k], before[k]));
    if (!unchanged) {
      conflicts++;
      continue;
    }
    await repo.remove(current.id);
    deletes.push({ collection, id: current.id });
  }

  const at = now();
  const batch: ImportBatch = {
    ...args.base,
    id: args.batchId,
    moduleId: manifest.id,
    importerId: args.importerId,
    source: args.source,
    createdAt: args.base?.createdAt ?? at,
    committedAt: at,
    records,
    status: 'committed',
    rows: undefined,
    ...(updates.length > 0 ? { updates } : {}),
    ...(deletes.length > 0 ? { deletes } : {}),
    ...(conflicts > 0 ? { conflicts } : {}),
  };
  await table(database).put(batch);
  return batch;
}

export function countRecords(batch: ImportBatch): number {
  return (
    batch.records.reduce((n, r) => n + r.ids.length, 0) +
    (batch.updates?.length ?? 0) +
    (batch.deletes?.length ?? 0)
  );
}

export const batchStatus = (batch: ImportBatch): BatchStatus =>
  batch.status ?? (batch.undoneAt ? 'undone' : 'committed');

/**
 * Removes what the batch created – but only records nobody has touched since (`updatedAt` equals
 * `createdAt`) – and restores the previous values of records it changed, if they still hold the
 * imported values. Edited records stay; their number is reported. Deletions are tombstones and sync.
 */
export async function undoImport(
  manifest: ModuleManifest,
  batchId: string,
  database: TaschenmesserDB = defaultDb,
  handlers?: Record<string, AiActionHandler>,
): Promise<{ removed: number; kept: number }> {
  const batch = await table(database).get(batchId);
  if (!batch || batchStatus(batch) !== 'committed') return { removed: 0, kept: 0 };
  let removed = 0;
  let kept = 0;
  for (const { collection, ids } of batch.records) {
    const def = manifest.dataSchema.collections[collection];
    if (!def) continue;
    const repo = createCollectionRepo(manifest, collection, database);
    const rows = await repo.table.bulkGet(ids);
    const untouched: string[] = [];
    for (const row of rows) {
      if (!row || row.deletedAt !== null) continue; // gone already
      if (row.updatedAt === row.createdAt) untouched.push(row.id);
      else kept++;
    }
    await repo.removeMany(untouched);
    removed += untouched.length;
  }
  for (const change of batch.updates ?? []) {
    if (!manifest.dataSchema.collections[change.collection]) continue;
    const repo = createCollectionRepo(manifest, change.collection, database);
    const current = await repo.get(change.id);
    const still =
      current !== undefined &&
      Object.keys(change.after).every((k) => deepEqual(current[k], change.after[k]));
    if (!still) {
      kept++;
      continue;
    }
    const handler = change.via ? handlers?.[change.via] : undefined;
    if (handler?.revert) await handler.revert(change.id, change.before);
    else await repo.update(change.id, change.before);
    removed++;
  }
  for (const gone of batch.deletes ?? []) {
    if (!manifest.dataSchema.collections[gone.collection]) continue;
    const repo = createCollectionRepo(manifest, gone.collection, database);
    await repo.restore(gone.id);
    removed++;
  }
  await table(database).update(batchId, { undoneAt: now(), keptOnUndo: kept, status: 'undone' });
  return { removed, kept };
}

export async function listBatches(
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch[]> {
  const all = await table(database).where('moduleId').equals(moduleId).toArray();
  // Waiting and rejected API batches are not imports (yet); they have their own place.
  return all
    .filter((b) => ['committed', 'undone'].includes(batchStatus(b)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Live list for the wizard ("Zuletzt importiert"). */
export function useImportBatches(moduleId: string): ImportBatch[] | undefined {
  return useLiveQuery(() => listBatches(moduleId), [moduleId]);
}

/* ---- "Don't offer the wizard again" flag, per device ---- */

const seenKey = (moduleId: string) => `onboarding.${moduleId}`;
const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function markOnboardingHandled(
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await meta(database).put({ key: seenKey(moduleId), value: now() });
}

export async function wasOnboardingHandled(
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<boolean> {
  return (await meta(database).get(seenKey(moduleId))) !== undefined;
}
