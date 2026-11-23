/**
 * "Alle Daten auf diesem Gerät löschen": removes the local database, the device's secrets and the
 * device-local preferences, then reloads. Synced data on a server and backup files are untouched.
 *
 * Order: everything that must be read from the database first (secret names, partner-share codes,
 * vault seals, the push subscription), then the push subscription is withdrawn from the server and
 * the native part runs (`device_wipe`: home-network hub and pairings, downloads, torrent, browser
 * profile, PC-care journal when nothing can be undone, panic log, extension registration, and the
 * local AI models when ticked), then secrets, seals, preferences and the database. A failing step
 * never stops the reset.
 */
import { loadAiConfig, keyName } from '@/core/ai/config';
import { BIO_SEAL, BIO_SECRET, PIN_SECRET } from '@/core/applock/names';
import { AUTO_PASSPHRASE_SECRET } from '@/core/backup/safety';
import { accountKey, connectorSecret, secretName } from '@/core/connectors/context';
import { loadStatus } from '@/core/connectors/state';
import { connectors } from '@/core/connectors/registry';
import { parseHeader, vaultSealName } from '@/core/crypto';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getPlatform, type BiometricService } from '@/core/platform';
import type { DeviceWipeReport, DeviceWipeService } from '@/core/platform/deviceWipe';
import { loadPairs } from '@/core/share/pairs';
import type { SecretStore } from '@/core/secrets/types';
import { SYNC_TOKEN_SECRET } from '@/core/sync/names';

/** Secrets kept outside the database (OS keystore or device key) that belong to this device's data. */
export async function deviceSecretNames(database: TaschenmesserDB = defaultDb): Promise<string[]> {
  const ai = await loadAiConfig(database).catch(() => ({ providers: [] as { id: string }[] }));
  const extraAccounts = (
    await Promise.all(
      connectors
        .filter((c) => c.multiAccount)
        .map(async (c) =>
          ((await loadStatus(c.id, database).catch(() => undefined))?.accounts ?? []).map((a) =>
            secretName(accountKey(c.id, a.id), 'refresh'),
          ),
        ),
    )
  ).flat();
  // Partner-share pairing codes (`share.code.<id>`, see `core/share/pairs.ts`).
  const shareCodes = (await loadPairs(database).catch(() => [])).map((p) => `share.code.${p.id}`);
  return [
    ...ai.providers.map((p) => keyName(p.id)),
    ...extraAccounts,
    ...shareCodes,
    AUTO_PASSPHRASE_SECRET,
    SYNC_TOKEN_SECRET,
    PIN_SECRET,
    BIO_SECRET,
    ...connectors.flatMap((c) => [
      secretName(c.id, 'client-id'),
      secretName(c.id, 'client-secret'),
      secretName(c.id, 'refresh'),
      ...(c.secretNames ?? []).map((n) => connectorSecret(c.id, n)),
    ]),
  ];
}

/** Table of the password vault's header (one Dexie table per collection: `<moduleId>_<collection>`). */
const VAULT_TABLE = 'accounts_vault';

/**
 * Names under which the password vault's data key is sealed by the OS (biometric unlock). The seal is
 * no secret-store entry, so `deviceSecretNames` does not know it; with it left behind, any copy of the
 * old ciphertext (backup, sync server) would stay openable on this OS account without the master password.
 */
export async function vaultSealNames(database: TaschenmesserDB = defaultDb): Promise<string[]> {
  if (!database.tables.some((t) => t.name === VAULT_TABLE)) return [];
  const rows = await database.table<{ header?: unknown }>(VAULT_TABLE).toArray();
  const names: string[] = [];
  for (const row of rows) {
    try {
      if (typeof row.header === 'string')
        names.push(vaultSealName(parseHeader(row.header).vaultId));
    } catch {
      // A header we cannot read has no seal we could name; the row is deleted with the database anyway.
    }
  }
  return names;
}

export interface ResetDeps {
  database: TaschenmesserDB;
  secrets: SecretStore;
  biometrics: Pick<BiometricService, 'remove'>;
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> | undefined;
  /** Native part (apps); unsupported in the browser. */
  native: Pick<DeviceWipeService, 'supported' | 'wipe'>;
  /** Withdraws this device's Web Push subscription from the sync server (best effort). */
  disablePush(database: TaschenmesserDB): Promise<void>;
  reload(): void;
}

export interface ResetOptions {
  /** Also remove downloaded local AI models (desktop; a checkbox in the dialog). */
  models?: boolean;
}

/** A step that does not answer in this time is left behind (an unreachable server, a stuck OS call). */
const STEP_TIMEOUT_MS = 10_000;
/** The native part does several things in a row (hub, pairing goodbye, torrent, browser, models). */
const NATIVE_TIMEOUT_MS = 30_000;

function withTimeout<T>(p: Promise<T>, fallback: T, ms = STEP_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

async function defaultDisablePush(database: TaschenmesserDB): Promise<void> {
  const { disablePush, defaultPushDeps } = await import('@/core/notifications/push');
  await disablePush({ ...defaultPushDeps(), database });
}

function localStorageOrUndefined(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined; // storage blocked
  }
}

export async function resetDevice(
  deps?: Partial<ResetDeps>,
  options: ResetOptions = {},
): Promise<DeviceWipeReport | undefined> {
  const database = deps?.database ?? defaultDb;
  const secrets = deps?.secrets ?? getPlatform().secrets;
  const biometrics = deps?.biometrics ?? getPlatform().biometrics;
  const storage = deps && 'storage' in deps ? deps.storage : localStorageOrUndefined();
  const native = deps?.native ?? getPlatform().deviceWipe;
  const disablePush = deps?.disablePush ?? defaultDisablePush;
  const reload = deps?.reload ?? (() => location.reload());

  // Everything read from the database first: the AI provider list, the share pairs, the vault header.
  const names = await deviceSecretNames(database).catch(() => [] as string[]);
  const seals = await vaultSealNames(database).catch(() => [] as string[]);
  // The push subscription lives in the database too; the server keeps sending without this.
  await withTimeout(disablePush(database), undefined);
  // Native files and keys (hub, pairings, downloads …) before the database: nothing paired with
  // this device may outlive the reset.
  const report = native.supported
    ? await withTimeout<DeviceWipeReport>(
        native.wipe({ models: options.models === true }),
        { failed: ['native'], kept: [] },
        NATIVE_TIMEOUT_MS,
      )
    : undefined;
  // A failing or hanging OS call must not stop the reset (nor outlast the native hub hold).
  await withTimeout(
    (async () => {
      for (const name of names) await secrets.delete(name).catch(() => undefined);
      for (const name of seals) await biometrics.remove(name).catch(() => undefined);
    })(),
    undefined,
  );
  await biometrics.remove(BIO_SEAL).catch(() => undefined); // the app lock's seal

  if (storage) {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (k): k is string => k !== null && k.startsWith('tm-'),
    );
    for (const k of keys) storage.removeItem(k);
  }

  database.close();
  await database.delete();
  reload();
  return report;
}
