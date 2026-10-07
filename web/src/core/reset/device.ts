/**
 * "Alle Daten auf diesem Gerät löschen": removes the local database, the device's secrets and the
 * device-local preferences, then reloads. Synced data on a server and backup files are untouched.
 */
import { loadAiConfig, keyName } from '@/core/ai/config';
import { AUTO_PASSPHRASE_SECRET } from '@/core/backup/safety';
import { connectorSecret, secretName } from '@/core/connectors/context';
import { connectors } from '@/core/connectors/registry';
import { parseHeader, vaultSealName } from '@/core/crypto';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getPlatform, type BiometricService } from '@/core/platform';
import type { SecretStore } from '@/core/secrets/types';

/** The user must type this to confirm. */
export const RESET_PHRASE = 'LÖSCHEN';

/** Secrets kept outside the database (OS keystore or device key) that belong to this device's data. */
export async function deviceSecretNames(database: TaschenmesserDB = defaultDb): Promise<string[]> {
  const ai = await loadAiConfig(database).catch(() => ({ providers: [] as { id: string }[] }));
  return [
    ...ai.providers.map((p) => keyName(p.id)),
    AUTO_PASSPHRASE_SECRET,
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
  reload(): void;
}

function localStorageOrUndefined(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined; // storage blocked
  }
}

export async function resetDevice(deps?: Partial<ResetDeps>): Promise<void> {
  const database = deps?.database ?? defaultDb;
  const secrets = deps?.secrets ?? getPlatform().secrets;
  const biometrics = deps?.biometrics ?? getPlatform().biometrics;
  const storage = deps && 'storage' in deps ? deps.storage : localStorageOrUndefined();
  const reload = deps?.reload ?? (() => location.reload());

  // Names first (the AI provider list is in the database), then the secrets, then the database.
  const names = await deviceSecretNames(database);
  for (const name of names) await secrets.delete(name).catch(() => undefined);
  // The vault header must be read before the database goes; a failing OS call must not stop the reset.
  for (const name of await vaultSealNames(database).catch(() => [] as string[])) {
    await biometrics.remove(name).catch(() => undefined);
  }

  if (storage) {
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(
      (k): k is string => k !== null && k.startsWith('tm-'),
    );
    for (const k of keys) storage.removeItem(k);
  }

  database.close();
  await database.delete();
  reload();
}
