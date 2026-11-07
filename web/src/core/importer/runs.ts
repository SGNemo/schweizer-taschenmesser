/**
 * Runs of "Umzug von einer anderen App": the batches one sheet run wrote share a `groupId` (one per
 * module). A run is listed and undone as a whole; each batch keeps its own undo rules (edited
 * records stay). Local only (`_imports`), counts and names of sources only.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getManifest } from '@/core/modules/registry';
import { batchStatus, countRecords, undoImport } from './batches';
import type { ImportBatch } from './types';

export interface ImportRun {
  groupId: string;
  /** Source of the first batch ("Takeout.zip", "3 Dateien"). */
  source: string;
  createdAt: number;
  /** Per module: what this run wrote there. */
  parts: { moduleId: string; batchId: string; count: number; undone: boolean }[];
  /** Records still in place (committed parts). */
  count: number;
  /** Every part was undone. */
  undone: boolean;
}

const table = (database: TaschenmesserDB) => database.table<ImportBatch, string>('_imports');

/** Pure: batches → runs, newest first. Only wizard batches with a group id (the sheet sets one). */
export function groupRuns(batches: readonly ImportBatch[]): ImportRun[] {
  const runs = new Map<string, ImportRun>();
  for (const b of batches) {
    const status = batchStatus(b);
    if (!b.groupId || (b.origin && b.origin !== 'wizard')) continue;
    if (status !== 'committed' && status !== 'undone') continue;
    const run = runs.get(b.groupId) ?? {
      groupId: b.groupId,
      source: b.source,
      createdAt: b.createdAt,
      parts: [],
      count: 0,
      undone: true,
    };
    const undone = status === 'undone';
    run.parts.push({ moduleId: b.moduleId, batchId: b.id, count: countRecords(b), undone });
    if (!undone) run.count += countRecords(b);
    run.undone &&= undone;
    if (b.createdAt < run.createdAt) {
      run.createdAt = b.createdAt;
      run.source = b.source;
    }
    runs.set(b.groupId, run);
  }
  return [...runs.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export async function listRuns(database: TaschenmesserDB = defaultDb): Promise<ImportRun[]> {
  return groupRuns(
    await table(database)
      .filter((b) => Boolean(b.groupId))
      .toArray(),
  );
}

export async function getRun(
  groupId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<ImportRun | undefined> {
  return groupRuns(
    await table(database)
      .filter((b) => b.groupId === groupId)
      .toArray(),
  )[0];
}

/** Live list for Settings; `undefined` while loading. */
export function useImportRuns(): ImportRun[] | undefined {
  return useLiveQuery(() => listRuns(), []);
}

/** Live single run (the summary after the last part). */
export function useImportRun(groupId: string | undefined): ImportRun | null | undefined {
  return useLiveQuery(async () => (groupId ? ((await getRun(groupId)) ?? null) : null), [groupId]);
}

/** Undoes every committed part of the run; edited records stay and are counted as kept. */
export async function undoRun(
  groupId: string,
  database: TaschenmesserDB = defaultDb,
): Promise<{ removed: number; kept: number }> {
  const batches = await table(database)
    .filter((b) => b.groupId === groupId)
    .toArray();
  let removed = 0;
  let kept = 0;
  for (const b of batches) {
    const manifest = getManifest(b.moduleId);
    if (!manifest || batchStatus(b) !== 'committed') continue;
    const r = await undoImport(manifest, b.id, database);
    removed += r.removed;
    kept += r.kept;
  }
  return { removed, kept };
}
