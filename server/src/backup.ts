/**
 * Consistent online backup of the sync database (SQLite backup API, safe while the server runs and
 * WAL mode is on), with rotation. Used by `dist/backup-cli.js`; see `docs/features/backup-sync.md`.
 *
 * The copy holds exactly what the server holds: with end-to-end encryption on, values are
 * ciphertext; without it they are plain. Protect the backup folder like the live volume.
 */
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const PREFIX = 'sync-';
const NAME_RE = /^sync-(\d{8}T\d{6}Z)\.db$/;

export const backupName = (at: Date): string =>
  `${PREFIX}${at
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')}.db`;

export interface BackupResult {
  file: string;
  pruned: string[];
}

export async function backupDatabase(
  dbPath: string,
  destDir: string,
  keep = 7,
  at: Date = new Date(),
): Promise<BackupResult> {
  mkdirSync(destDir, { recursive: true, mode: 0o700 });
  const file = join(destDir, backupName(at));
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    await db.backup(file);
  } finally {
    db.close();
  }
  // Prove that the copy opens and is intact before older copies are rotated away.
  // Also switch the copy to a rollback journal so it stays one self-contained file.
  const check = new Database(file);
  try {
    check.pragma('journal_mode = DELETE');
    const result = check.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw new Error('backup failed its integrity check');
  } finally {
    check.close();
  }
  const names = readdirSync(destDir)
    .filter((n) => NAME_RE.test(n))
    .sort()
    .reverse();
  const pruned = names.slice(Math.max(1, keep));
  for (const n of pruned) rmSync(join(destDir, n), { force: true });
  return { file, pruned };
}
