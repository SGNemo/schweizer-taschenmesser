/** Safety copy taken right before a restore, and the pruning shared with the other backup folders. */
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { createBackup, serializeBackup } from './backup';
import { encryptBackup, serializeEncryptedBackup } from './encrypted';

export const BACKUP_DIR = 'backups';
export const SAFETY_PREFIX = 'pre-restore-';
export const KEEP_SAFETY_BACKUPS = 3;
/** Secret name of the passphrase used for unattended (automatic) backups. */
export const AUTO_PASSPHRASE_SECRET = 'backup.autoPassphrase';

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** `YYYYMMDD-HHMMSS` in local time; sorts chronologically as a string. */
export function stampOf(at: Date): string {
  return `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
}

/** Names to delete so that only the newest `keep` files with this `prefix` remain. */
export function namesToPrune(names: readonly string[], prefix: string, keep: number): string[] {
  const re = new RegExp(`^${prefix}(\\d{8}-\\d{6})\\.`);
  return names
    .filter((n) => re.test(n))
    .sort((a, b) => re.exec(b)![1]!.localeCompare(re.exec(a)![1]!))
    .slice(Math.max(0, keep));
}

export class SafetyBackupError extends Error {
  constructor(readonly reason: 'cancelled' | 'failed') {
    super(`safety backup ${reason}`);
    this.name = 'SafetyBackupError';
  }
}

export interface SafetyDeps {
  createBackup: typeof createBackup;
  files?: ReturnType<typeof getPlatform>['files'];
  isNative: boolean;
  saveFile: ReturnType<typeof getPlatform>['saveFile'];
  storedPassphrase(): Promise<string | undefined>;
  kdf?: { m?: number; t?: number; p?: number };
}

const defaultSafetyDeps = (): SafetyDeps => {
  const platform = getPlatform();
  return {
    createBackup: () => createBackup(),
    files: platform.files,
    isNative: platform.isNative,
    saveFile: (req) => platform.saveFile(req),
    storedPassphrase: () => platform.secrets.get(AUTO_PASSPHRASE_SECRET),
  };
};

/**
 * Writes a full backup of the current data. Native: into the app's data folder (older copies are
 * pruned). Browser: offered as a download; cancelling aborts the restore. Encrypted when a
 * passphrase is known (the one the user just typed, else the stored automatic-backup passphrase).
 * Returns where it went; throws `SafetyBackupError` when no copy could be made – the caller must
 * then not restore.
 */
export async function createSafetyBackup(
  passphrase?: string,
  deps: SafetyDeps = defaultSafetyDeps(),
): Promise<string> {
  try {
    const at = new Date(now());
    const backup = await deps.createBackup(undefined, undefined, at);
    const secret = passphrase ?? (deps.isNative ? await deps.storedPassphrase() : undefined);
    const text = secret
      ? serializeEncryptedBackup(await encryptBackup(backup, secret, deps.kdf, at))
      : serializeBackup(backup);
    const name = `${SAFETY_PREFIX}${stampOf(at)}${secret ? '.enc.json' : '.json'}`;

    if (deps.isNative && deps.files) {
      await deps.files.write(`${BACKUP_DIR}/${name}`, text);
      try {
        for (const old of namesToPrune(
          await deps.files.list(BACKUP_DIR),
          SAFETY_PREFIX,
          KEEP_SAFETY_BACKUPS,
        ))
          await deps.files.remove(`${BACKUP_DIR}/${old}`);
      } catch {
        // pruning is best effort; the new copy exists
      }
      return `${BACKUP_DIR}/${name}`;
    }
    const result = await deps.saveFile({ fileName: name, data: text, mime: 'application/json' });
    if (result === 'cancelled') throw new SafetyBackupError('cancelled');
    return name;
  } catch (e) {
    if (e instanceof SafetyBackupError) throw e;
    throw new SafetyBackupError('failed');
  }
}
