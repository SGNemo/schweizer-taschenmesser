/** Local safety copy taken right before an update is installed. */
import { createBackup, serializeBackup } from '@/core/backup/backup';
import { encryptBackup, serializeEncryptedBackup } from '@/core/backup/encrypted';
import { AUTO_PASSPHRASE_SECRET } from '@/core/backup/safety';
import { getPlatform } from '@/core/platform';

export const BACKUP_DIR = 'backups';
export const KEEP_BACKUPS = 3;
const PREFIX = 'pre-update-';
const STAMP_RE = /-(\d{8}-\d{6})\.json$/;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const safe = (v: string) => v.replace(/[^0-9A-Za-z.+-]/g, '_');

export function preUpdateBackupName(from: string, to: string, at: Date): string {
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${PREFIX}${safe(from)}-to-${safe(to)}-${stamp}.json`;
}

/** Names to delete so that only the newest `keep` pre-update backups remain (other files are never touched). */
export function backupsToPrune(names: readonly string[], keep = KEEP_BACKUPS): string[] {
  const ours = names
    .filter((n) => n.startsWith(PREFIX) && STAMP_RE.test(n))
    .sort((a, b) => STAMP_RE.exec(b)![1]!.localeCompare(STAMP_RE.exec(a)![1]!));
  return ours.slice(keep);
}

/**
 * Writes a full backup (encrypted if a backup passphrase is set) into the app's data folder and prunes old ones. Throws when the copy
 * cannot be written – the caller must then not install the update.
 */
export async function createPreUpdateBackup(
  from: string,
  to: string,
  at = new Date(),
): Promise<string> {
  const { files } = getPlatform();
  const path = `${BACKUP_DIR}/${preUpdateBackupName(from, to, at)}`;
  const backup = await createBackup();
  // Encrypted when a backup passphrase is set (automatic backups); the name stays the same, the
  // content is recognised by its format. Without a passphrase it stays plain JSON as before.
  let text = serializeBackup(backup);
  try {
    const passphrase = await getPlatform().secrets.get(AUTO_PASSPHRASE_SECRET);
    if (passphrase) text = serializeEncryptedBackup(await encryptBackup(backup, passphrase));
  } catch {
    // no readable secret store: keep the plain copy rather than blocking the update
  }
  await files.write(path, text);
  try {
    for (const name of backupsToPrune(await files.list(BACKUP_DIR))) {
      await files.remove(`${BACKUP_DIR}/${name}`);
    }
  } catch (e) {
    console.warn('[update] could not prune old backups', e);
  }
  return path;
}
