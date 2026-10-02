/**
 * "Alle Daten auf diesem Gerät löschen": removes the local database, the device's secrets and the
 * device-local preferences, then reloads. Synced data on a server and backup files are untouched.
 */
import { loadAiConfig, keyName } from '@/core/ai/config';
import { AUTO_PASSPHRASE_SECRET } from '@/core/backup/safety';
import { connectorSecret, secretName } from '@/core/connectors/context';
import { connectors } from '@/core/connectors/registry';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
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

export interface ResetDeps {
  database: TaschenmesserDB;
  secrets: SecretStore;
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
  const storage = deps && 'storage' in deps ? deps.storage : localStorageOrUndefined();
  const reload = deps?.reload ?? (() => location.reload());

  // Names first (the AI provider list is in the database), then the secrets, then the database.
  const names = await deviceSecretNames(database);
  for (const name of names) await secrets.delete(name).catch(() => undefined);

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
