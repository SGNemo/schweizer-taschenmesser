import { open, seal } from '@/core/crypto';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import type { SecretStore } from './types';

const DEVICE_KEY = 'deviceKey';
const ROW_PREFIX = 'secret:';
const enc = new TextEncoder();
const dec = new TextDecoder();

interface Row<T> {
  key: string;
  value: T;
}

const rows = <T>(database: TaschenmesserDB) => database.table<Row<T>, string>('_secrets');
const aad = (name: string) => `taschenmesser/secret/${name}`;

/**
 * The device key: created once, stored as a non-extractable `CryptoKey` in the local `_secrets`
 * table. `add` fails when the key already exists, so two tabs starting at once end up with the same
 * key (the loser adopts the winner's).
 */
export async function getDeviceKey(database: TaschenmesserDB = defaultDb): Promise<CryptoKey> {
  const existing = await rows<CryptoKey>(database).get(DEVICE_KEY);
  if (existing) return existing.value;
  const fresh = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
  try {
    await rows<CryptoKey>(database).add({ key: DEVICE_KEY, value: fresh }); // fails if it exists
    return fresh;
  } catch (e) {
    const raced = await rows<CryptoKey>(database).get(DEVICE_KEY);
    if (raced) return raced.value;
    throw e;
  }
}

export function createDeviceKeyStore(database: TaschenmesserDB = defaultDb): SecretStore {
  return {
    protection: 'device-key',
    async get(name) {
      const row = await rows<string>(database).get(ROW_PREFIX + name);
      if (!row) return undefined;
      try {
        return dec.decode(await open(await getDeviceKey(database), aad(name), row.value));
      } catch {
        return undefined; // key lost/replaced (e.g. site data cleared partly): treat as not set
      }
    },
    async set(name, value) {
      const token = await seal(await getDeviceKey(database), aad(name), enc.encode(value));
      await rows<string>(database).put({ key: ROW_PREFIX + name, value: token });
    },
    async delete(name) {
      await rows<string>(database).delete(ROW_PREFIX + name);
    },
  };
}
