import { readBackupText } from '@/core/backup/encrypted';
import { restoreBackup } from '@/core/backup/restore';
import { getPlatform } from '@/core/platform';
import { toDateString } from '@/core/time/now';
import { dumpDb, replaceWithEmptyDb, type DumpResult } from './health';
import { db as defaultDb, type TaschenmesserDB } from './db';

/**
 * Keeps a copy of the defective database for the user before anything destructive happens:
 * written to the app's data folder where the platform has one, otherwise offered as a download.
 * Resolves `false` when the user cancelled (the caller must then stop). Nothing to save counts as saved.
 */
export async function keepBrokenCopy(dump: DumpResult, platform = getPlatform()): Promise<boolean> {
  if (dump.rows === 0) return true;
  const fileName = `nemo-defekte-datenbank-${toDateString(new Date())}.json`;
  if (platform.kind !== 'web') {
    try {
      await platform.files.write(`backups/${fileName}`, dump.text);
      return true;
    } catch {
      // fall through to the manual save
    }
  }
  return (
    (await platform.saveFile({ fileName, data: dump.text, mime: 'application/json' })) === 'saved'
  );
}

export type RestoreOutcome =
  | { ok: true; records: number }
  | {
      ok: false;
      reason: 'unreadable' | 'passphrase-required' | 'wrong-passphrase' | 'cancelled' | 'failed';
    };

/** Copy of the defective state first, then a fresh database, then the chosen backup. */
export async function restoreIntoFreshDb(
  text: string,
  passphrase: string | undefined,
  database: TaschenmesserDB = defaultDb,
  platform = getPlatform(),
): Promise<RestoreOutcome> {
  const read = await readBackupText(text, passphrase);
  if (!read.ok) {
    if (read.reason === 'passphrase-required') return { ok: false, reason: 'passphrase-required' };
    if (read.reason === 'wrong-passphrase') return { ok: false, reason: 'wrong-passphrase' };
    return { ok: false, reason: 'unreadable' };
  }
  const dump = await dumpDb(database.name);
  if (!(await keepBrokenCopy(dump, platform))) return { ok: false, reason: 'cancelled' };
  try {
    await replaceWithEmptyDb(database);
    const { summary } = await restoreBackup(read.backup, 'replace', {
      database,
      safety: async () => 'recovery',
    });
    return { ok: true, records: summary.records };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}
