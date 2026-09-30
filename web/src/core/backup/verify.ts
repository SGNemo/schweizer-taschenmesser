/**
 * "Backup prüfen": proves that a backup file can really be restored, without touching the live data.
 *
 *  1. format      – is it one of our files (plain or encrypted), a version we understand?
 *  2. checksum    – encrypted files: SHA-256 of the ciphertext matches (damage / truncation)
 *  3. decrypt     – the passphrase opens it and nothing was modified (AEAD)
 *  4. structure   – every record passes the same validation as an import
 *  5. restore     – dry run: the backup is restored into a temporary database, which is deleted again
 *  6. counts      – the temporary database holds exactly the records of the file
 */
import { TaschenmesserDB } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { applyBackup, moduleOfTable } from './apply';
import type { Backup } from './backup';
import {
  checksumMatches,
  isEncryptedBackupText,
  parseEncryptedBackup,
  readBackupText,
} from './encrypted';

export type VerifyStepId = 'format' | 'checksum' | 'decrypt' | 'structure' | 'restore' | 'counts';

export interface VerifyStep {
  id: VerifyStepId;
  status: 'ok' | 'failed' | 'skipped';
}

export interface ModuleCount {
  module: string;
  /** Live records. */
  records: number;
  /** Deleted records kept for sync. */
  tombstones: number;
}

export interface VerifyReport {
  ok: boolean;
  encrypted: boolean;
  steps: VerifyStep[];
  /** Why the check failed (a `ReadFailure` code, or `restore-failed` / `count-mismatch`). */
  failure?: string;
  exportedAt?: string;
  modules: ModuleCount[];
  totals: { records: number; tombstones: number };
  /** Tables in the file that this app version does not know (they would be skipped). */
  skippedTables: number;
}

export interface VerifyDeps {
  tableNames: string[];
  /** A throw-away database; it is closed and deleted by the verifier. */
  createTempDb(): TaschenmesserDB;
}

let counter = 0;

export const defaultVerifyDeps = (): VerifyDeps => ({
  tableNames: syncedTableNames(allManifests),
  createTempDb: () => new TaschenmesserDB(`taschenmesser-verify-${Date.now()}-${counter++}`),
});

const STEPS: VerifyStepId[] = ['format', 'checksum', 'decrypt', 'structure', 'restore', 'counts'];

export function countByModule(backup: Backup, tableNames: string[]): ModuleCount[] {
  const known = new Set(tableNames);
  const byModule = new Map<string, ModuleCount>();
  for (const [name, rows] of Object.entries(backup.tables)) {
    if (!known.has(name)) continue;
    const module = moduleOfTable(name);
    const entry = byModule.get(module) ?? { module, records: 0, tombstones: 0 };
    for (const row of rows) {
      if (row.deletedAt === null) entry.records++;
      else entry.tombstones++;
    }
    byModule.set(module, entry);
  }
  return [...byModule.values()].sort((a, b) => a.module.localeCompare(b.module));
}

export async function verifyBackup(
  text: string,
  passphrase: string | undefined,
  deps: VerifyDeps = defaultVerifyDeps(),
): Promise<VerifyReport> {
  const encrypted = isEncryptedBackupText(text);
  const status = new Map<VerifyStepId, VerifyStep['status']>(STEPS.map((s) => [s, 'skipped']));
  const report = (extra: Partial<VerifyReport>): VerifyReport => ({
    ok: false,
    encrypted,
    steps: STEPS.map((id) => ({ id, status: status.get(id)! })),
    modules: [],
    totals: { records: 0, tombstones: 0 },
    skippedTables: 0,
    ...extra,
  });
  const fail = (id: VerifyStepId, failure: string, extra: Partial<VerifyReport> = {}) => {
    status.set(id, 'failed');
    return report({ failure, ...extra });
  };

  // 1 + 2: format and checksum (needs no passphrase)
  if (encrypted) {
    const file = parseEncryptedBackup(text);
    if (!file.ok) return fail('format', file.reason);
    status.set('format', 'ok');
    if (!(await checksumMatches(file.file))) return fail('checksum', 'checksum-mismatch');
    status.set('checksum', 'ok');
  }

  // 3 + 4: decrypt and validate
  const read = await readBackupText(text, passphrase);
  if (!read.ok) {
    if (!encrypted) return fail('format', read.reason);
    return read.reason === 'wrong-passphrase' || read.reason === 'passphrase-required'
      ? fail('decrypt', read.reason)
      : fail('structure', read.reason);
  }
  if (!encrypted) status.set('format', 'ok');
  status.set('decrypt', encrypted ? 'ok' : 'skipped');
  status.set('structure', 'ok');
  const { backup } = read;

  const modules = countByModule(backup, deps.tableNames);
  const totals = modules.reduce(
    (t, m) => ({ records: t.records + m.records, tombstones: t.tombstones + m.tombstones }),
    { records: 0, tombstones: 0 },
  );
  const known = new Set(deps.tableNames);
  const skippedTables = Object.keys(backup.tables).filter((n) => !known.has(n)).length;
  const details = { exportedAt: backup.exportedAt, modules, totals, skippedTables };

  // 5 + 6: dry-run restore into a temporary database
  const tmp = deps.createTempDb();
  try {
    try {
      await applyBackup(backup, 'replace', tmp, deps.tableNames);
    } catch {
      return fail('restore', 'restore-failed', details);
    }
    status.set('restore', 'ok');
    for (const [name, rows] of Object.entries(backup.tables)) {
      if (!known.has(name)) continue;
      if ((await tmp.table(name).count()) !== rows.length)
        return fail('counts', 'count-mismatch', details);
    }
    status.set('counts', 'ok');
    return report({ ok: true, ...details });
  } finally {
    tmp.close();
    await tmp.delete().catch(() => undefined);
  }
}
