/** Restore with a mandatory safety copy first; the data change itself is one transaction (`apply.ts`). */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { applyBackup, planRestore, type ApplyHooks, type RestorePlan } from './apply';
import type { Backup, ImportMode, ImportSummary } from './backup';

export { planRestore, type RestorePlan, type ModuleChange } from './apply';

export interface RestoreOptions {
  database?: TaschenmesserDB;
  tableNames?: string[];
  /** Takes the safety copy; must throw when it cannot (then nothing is restored). */
  safety: () => Promise<string>;
  /** Abort before anything is written. Once the transaction runs it is all-or-nothing anyway. */
  signal?: AbortSignal;
  hooks?: ApplyHooks;
}

export interface RestoreResult {
  summary: ImportSummary;
  /** Where the safety copy went. */
  safetyBackup: string;
}

export class RestoreAborted extends Error {
  constructor() {
    super('restore aborted');
    this.name = 'RestoreAborted';
  }
}

export function preview(
  backup: Backup,
  mode: ImportMode,
  database: TaschenmesserDB = defaultDb,
  tableNames: string[] = syncedTableNames(allManifests),
): Promise<RestorePlan> {
  return planRestore(backup, mode, database, tableNames);
}

export async function restoreBackup(
  backup: Backup,
  mode: ImportMode,
  opts: RestoreOptions,
): Promise<RestoreResult> {
  const database = opts.database ?? defaultDb;
  const tableNames = opts.tableNames ?? syncedTableNames(allManifests);
  if (opts.signal?.aborted) throw new RestoreAborted();
  const safetyBackup = await opts.safety();
  if (opts.signal?.aborted) throw new RestoreAborted();
  const summary = await applyBackup(backup, mode, database, tableNames, opts.hooks);
  return { summary, safetyBackup };
}
