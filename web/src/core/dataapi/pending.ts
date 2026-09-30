/**
 * Imports that wait for the user's confirmation (sent through the local API). They live in the
 * local `_imports` table with status `pending` and their checked entries; confirming re-checks them
 * against the current data (duplicates, validity) and writes through the normal repos (sync).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { batchStatus, commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import type { ImportBatch, PreviewRow } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { now } from '@/core/time/now';
import { createJsonRuntime } from './importer';

export const API_IMPORTER_ID = 'api';

const table = (database: TaschenmesserDB) => database.table<ImportBatch, string>('_imports');

export class BatchError extends Error {
  constructor(readonly code: 'not-found' | 'not-pending') {
    super(code);
  }
}

export async function createPendingBatch(
  manifest: ModuleManifest,
  args: {
    batchId: string;
    rows: PreviewRow[];
    tokenId: string;
    tokenName: string;
    idempotencyKey?: string;
    bodyHash: string;
    result: unknown;
  },
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch> {
  const batch: ImportBatch = {
    id: args.batchId,
    moduleId: manifest.id,
    importerId: API_IMPORTER_ID,
    source: args.tokenName,
    createdAt: now(),
    records: [],
    status: 'pending',
    origin: 'api',
    tokenId: args.tokenId,
    tokenName: args.tokenName,
    ...(args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : {}),
    bodyHash: args.bodyHash,
    rows: args.rows,
    result: args.result,
  };
  await table(database).put(batch);
  return batch;
}

export async function getBatch(
  id: string,
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch | undefined> {
  return table(database).get(id);
}

/** The waiting entries re-checked against the current data (what the review dialog shows). */
export async function reviewRows(
  manifest: ModuleManifest,
  batch: ImportBatch,
  database: TaschenmesserDB = defaultDb,
): Promise<PreviewRow[]> {
  return buildPreview(
    manifest,
    createJsonRuntime(manifest, database),
    (batch.rows ?? []).map((r) => r.candidate),
  );
}

/**
 * Writes a waiting batch. `selected` = indexes the user ticked; without it the default selection
 * applies (new, valid, not yet stored entries – never changes of existing ones).
 */
export async function commitPendingBatch(
  manifest: ModuleManifest,
  batchId: string,
  selected?: readonly number[],
  database: TaschenmesserDB = defaultDb,
): Promise<ImportBatch> {
  const batch = await table(database).get(batchId);
  if (!batch || batch.moduleId !== manifest.id) throw new BatchError('not-found');
  if (batchStatus(batch) !== 'pending') throw new BatchError('not-pending');
  let rows = await reviewRows(manifest, batch, database);
  if (selected)
    rows = rows.map((r) => ({ ...r, selected: selected.includes(r.index) && !r.invalid }));
  return commitImport(
    manifest,
    { batchId, importerId: batch.importerId, source: batch.source, rows, base: batch },
    database,
  );
}

export async function rejectBatch(
  batchId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  const batch = await table(database).get(batchId);
  if (!batch) throw new BatchError('not-found');
  if (batchStatus(batch) !== 'pending') throw new BatchError('not-pending');
  await table(database).update(batchId, { status: 'rejected', rows: undefined });
}

export async function listApiBatches(
  database: TaschenmesserDB = defaultDb,
  tokenId?: string,
): Promise<ImportBatch[]> {
  const all = await table(database).toArray();
  return all
    .filter((b) => b.origin === 'api' && (tokenId === undefined || b.tokenId === tokenId))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function usePendingBatches(): ImportBatch[] | undefined {
  return useLiveQuery(
    async () => (await listApiBatches()).filter((b) => batchStatus(b) === 'pending'),
    [],
  );
}

export function useApiBatches(): ImportBatch[] | undefined {
  return useLiveQuery(() => listApiBatches(), []);
}
