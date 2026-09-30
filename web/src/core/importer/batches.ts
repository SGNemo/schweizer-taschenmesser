/** Batch bookkeeping, the write step and "Import rückgängig machen". Local only (`_imports`). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import type { ModuleManifest } from '@/core/modules/types';
import { now } from '@/core/time/now';
import { ImportError } from './plan';
import type { ImportBatch, PreviewRow } from './types';

const table = (database: TaschenmesserDB) => database.table<ImportBatch, string>('_imports');

export function newBatchId(): string {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12);
}

/**
 * Writes the ticked rows of the preview – one `createMany` per collection – and records the batch.
 * Ids are `imp-<batch>-<n>` unless the candidate fixes one, so a repeated commit is idempotent.
 */
export async function commitImport(
  manifest: ModuleManifest,
  args: { batchId: string; importerId: string; source: string; rows: PreviewRow[] },
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch> {
  const chosen = args.rows.filter((r) => r.selected && !r.invalid);
  if (chosen.length === 0) throw new ImportError('nothing-selected');

  const byCollection = new Map<string, { data: Record<string, unknown>; id: string }[]>();
  chosen.forEach((row, n) => {
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

  const batch: ImportBatch = {
    id: args.batchId,
    moduleId: manifest.id,
    importerId: args.importerId,
    source: args.source,
    createdAt: now(),
    records,
  };
  await table(database).put(batch);
  return batch;
}

export function countRecords(batch: ImportBatch): number {
  return batch.records.reduce((n, r) => n + r.ids.length, 0);
}

/**
 * Removes what the batch created – but only records nobody has touched since (`updatedAt` equals
 * `createdAt`). Edited records stay; their number is reported. Deletions are tombstones and sync.
 */
export async function undoImport(
  manifest: ModuleManifest,
  batchId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<{ removed: number; kept: number }> {
  const batch = await table(database).get(batchId);
  if (!batch || batch.undoneAt) return { removed: 0, kept: 0 };
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
  await table(database).update(batchId, { undoneAt: now(), keptOnUndo: kept });
  return { removed, kept };
}

export async function listBatches(
  moduleId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch[]> {
  const all = await table(database).where('moduleId').equals(moduleId).toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
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
