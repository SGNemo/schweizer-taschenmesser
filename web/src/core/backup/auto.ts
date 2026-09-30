/**
 * Automatic local backups (native app only): an encrypted backup in the app's data folder at a
 * fixed rhythm, the newest N kept. The PWA has no writable folder, so it offers manual encrypted
 * exports instead (`supported` is false there).
 *
 * The passphrase for unattended encryption lives in the platform secret store (OS keystore on the
 * desktop/Android app); the settings and the last-run status are device-local (`_meta`, never
 * synced or exported). Encryption is Argon2id + AES-256-GCM through the crypto service.
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { getPlatform } from '@/core/platform';
import type { SecretStore } from '@/core/secrets/types';
import { now } from '@/core/time/now';
import { createBackup } from './backup';
import {
  checksumMatches,
  encryptBackup,
  MIN_BACKUP_PASSPHRASE_LENGTH,
  parseEncryptedBackup,
  serializeEncryptedBackup,
} from './encrypted';
import { AUTO_PASSPHRASE_SECRET, BACKUP_DIR, namesToPrune, stampOf } from './safety';

export const AUTO_DIR = `${BACKUP_DIR}/auto`;
export const AUTO_PREFIX = 'auto-';
const CONFIG_KEY = 'backup.auto.config';
const LAST_KEY = 'backup.auto.last';

export type AutoInterval = 'daily' | 'weekly';
export const INTERVAL_MS: Record<AutoInterval, number> = {
  daily: 24 * 3600_000,
  weekly: 7 * 24 * 3600_000,
};

export interface AutoBackupConfig {
  enabled: boolean;
  interval: AutoInterval;
  /** How many automatic backups are kept. */
  keep: number;
}

export const DEFAULT_AUTO_CONFIG: AutoBackupConfig = { enabled: false, interval: 'daily', keep: 7 };
export const MIN_KEEP = 1;
export const MAX_KEEP = 30;

export interface AutoBackupLast {
  at: number;
  ok: boolean;
  /** Stable code (never a message with paths): `write-failed`, … */
  error?: string;
  file?: string;
}

export type AutoBackupOutcome =
  | { status: 'created'; file: string; pruned: number }
  | { status: 'skipped'; reason: 'unsupported' | 'disabled' | 'not-due' | 'no-passphrase' | 'busy' }
  | { status: 'failed'; error: string };

export interface AutoBackupDeps {
  database: TaschenmesserDB;
  tableNames: string[];
  /** False in the browser. */
  supported: boolean;
  files: ReturnType<typeof getPlatform>['files'];
  secrets: SecretStore;
  kdf?: { m?: number; t?: number; p?: number };
}

export function defaultAutoDeps(): AutoBackupDeps {
  const platform = getPlatform();
  return {
    database: defaultDb,
    tableNames: syncedTableNames(allManifests),
    supported: platform.isNative,
    files: platform.files,
    secrets: platform.secrets,
  };
}

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export function sanitizeConfig(input: Partial<AutoBackupConfig> | undefined): AutoBackupConfig {
  const keep = Number.isInteger(input?.keep) ? (input!.keep as number) : DEFAULT_AUTO_CONFIG.keep;
  return {
    enabled: input?.enabled === true,
    interval: input?.interval === 'weekly' ? 'weekly' : 'daily',
    keep: Math.min(MAX_KEEP, Math.max(MIN_KEEP, keep)),
  };
}

export async function loadAutoConfig(
  database: TaschenmesserDB = defaultDb,
): Promise<AutoBackupConfig> {
  return sanitizeConfig((await meta(database).get(CONFIG_KEY))?.value as never);
}

export async function saveAutoConfig(
  config: AutoBackupConfig,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await meta(database).put({ key: CONFIG_KEY, value: sanitizeConfig(config) });
}

export async function loadAutoLast(
  database: TaschenmesserDB = defaultDb,
): Promise<AutoBackupLast | undefined> {
  return (await meta(database).get(LAST_KEY))?.value as AutoBackupLast | undefined;
}

export async function setAutoPassphrase(
  passphrase: string,
  secrets: SecretStore = getPlatform().secrets,
): Promise<boolean> {
  if (passphrase.length < MIN_BACKUP_PASSPHRASE_LENGTH) return false;
  await secrets.set(AUTO_PASSPHRASE_SECRET, passphrase);
  return true;
}

export async function hasAutoPassphrase(
  secrets: SecretStore = getPlatform().secrets,
): Promise<boolean> {
  return Boolean(await secrets.get(AUTO_PASSPHRASE_SECRET));
}

export function isDue(config: AutoBackupConfig, last: AutoBackupLast | undefined, at: number) {
  if (!last?.ok) return true;
  return at - last.at >= INTERVAL_MS[config.interval];
}

let running = false;

/** Creates an automatic backup when one is due (or `force`). Never throws. */
export async function runAutoBackup(
  opts: { force?: boolean } = {},
  deps: AutoBackupDeps = defaultAutoDeps(),
): Promise<AutoBackupOutcome> {
  if (!deps.supported) return { status: 'skipped', reason: 'unsupported' };
  if (running) return { status: 'skipped', reason: 'busy' };
  running = true;
  try {
    const config = await loadAutoConfig(deps.database);
    if (!opts.force && !config.enabled) return { status: 'skipped', reason: 'disabled' };
    const last = await loadAutoLast(deps.database);
    const at = now();
    if (!opts.force && !isDue(config, last, at)) return { status: 'skipped', reason: 'not-due' };
    const passphrase = await deps.secrets.get(AUTO_PASSPHRASE_SECRET);
    if (!passphrase) return { status: 'skipped', reason: 'no-passphrase' };

    const record = (value: AutoBackupLast) => meta(deps.database).put({ key: LAST_KEY, value });
    try {
      const date = new Date(at);
      const backup = await createBackup(deps.database, deps.tableNames, date);
      const file = await encryptBackup(backup, passphrase, deps.kdf, date);
      const text = serializeEncryptedBackup(file);
      // Read back what we are about to write: never rotate away good copies for a bad one.
      const check = parseEncryptedBackup(text);
      if (!check.ok || !(await checksumMatches(check.file))) throw new Error('self-check');
      const path = `${AUTO_DIR}/${AUTO_PREFIX}${stampOf(date)}.enc.json`;
      await deps.files.write(path, text);
      let pruned = 0;
      try {
        for (const name of namesToPrune(
          await deps.files.list(AUTO_DIR),
          AUTO_PREFIX,
          config.keep,
        )) {
          await deps.files.remove(`${AUTO_DIR}/${name}`);
          pruned++;
        }
      } catch {
        // rotation is best effort
      }
      await record({ at, ok: true, file: path });
      return { status: 'created', file: path, pruned };
    } catch {
      await record({ at, ok: false, error: 'write-failed' });
      return { status: 'failed', error: 'write-failed' };
    }
  } finally {
    running = false;
  }
}

export interface AutoBackupFile {
  name: string;
  /** `YYYYMMDD-HHMMSS` from the name. */
  stamp: string;
}

/** Automatic backups on this device, newest first. */
export async function listAutoBackups(
  files: AutoBackupDeps['files'] = getPlatform().files,
): Promise<AutoBackupFile[]> {
  const re = new RegExp(`^${AUTO_PREFIX}(\\d{8}-\\d{6})\\.enc\\.json$`);
  return (await files.list(AUTO_DIR))
    .flatMap((name) => {
      const m = re.exec(name);
      return m ? [{ name, stamp: m[1]! }] : [];
    })
    .sort((a, b) => b.stamp.localeCompare(a.stamp));
}

export async function readAutoBackup(
  name: string,
  files: AutoBackupDeps['files'] = getPlatform().files,
): Promise<string> {
  if (!/^auto-\d{8}-\d{6}\.enc\.json$/.test(name) || !files.read) throw new Error('unavailable');
  return files.read(`${AUTO_DIR}/${name}`);
}

const CHECK_EVERY_MS = 3600_000;
const FIRST_CHECK_MS = 30_000;

/** Checks shortly after start and then hourly; returns a stop function. */
export function startAutoBackup(deps: AutoBackupDeps = defaultAutoDeps()): () => void {
  if (!deps.supported) return () => undefined;
  const tick = () => void runAutoBackup({}, deps);
  const first = setTimeout(tick, FIRST_CHECK_MS);
  const interval = setInterval(tick, CHECK_EVERY_MS);
  return () => {
    clearTimeout(first);
    clearInterval(interval);
  };
}
