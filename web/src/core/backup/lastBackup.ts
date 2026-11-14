/**
 * The newest backup of this device, for the settings status head: an automatic run (native app)
 * or a backup the user saved as a file. Without the file case the head said "Kein Backup" right
 * after a download. Only the time is kept, device-local in `_meta`
 * (never synced, never in a backup); never a file name or path.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { now } from '@/core/time/now';
import { loadAutoLast } from './auto';

const FILE_KEY = 'backup.file.last';

export interface LastBackup {
  at: number;
  ok: boolean;
  kind: 'auto' | 'file';
}

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

// Bumped after every recorded file backup, so open status lines read again (a backup saved from the Gerätestatus
// dialog must not leave "Noch kein Backup" on the page behind it). Memory only, nothing stored.
let version = 0;
const listeners = new Set<() => void>();
export function subscribeLastBackup(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export const lastBackupVersion = (): number => version;

/** Call after a backup file was saved (not when the save dialog was cancelled). */
export async function recordFileBackup(
  database: TaschenmesserDB = defaultDb,
  at: number = now(),
): Promise<void> {
  await meta(database).put({ key: FILE_KEY, value: { at } });
  version++;
  for (const listener of listeners) listener();
}

export async function loadLastBackup(
  database: TaschenmesserDB = defaultDb,
): Promise<LastBackup | undefined> {
  const [auto, file] = await Promise.all([loadAutoLast(database), meta(database).get(FILE_KEY)]);
  const saved = file?.value as { at?: unknown } | undefined;
  const fileAt = typeof saved?.at === 'number' ? saved.at : undefined;
  if (auto && (fileAt === undefined || auto.at >= fileAt))
    return { at: auto.at, ok: auto.ok, kind: 'auto' };
  return fileAt === undefined ? undefined : { at: fileAt, ok: true, kind: 'file' };
}
