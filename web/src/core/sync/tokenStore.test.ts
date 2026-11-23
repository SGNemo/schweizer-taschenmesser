/**
 * S5 (launch review 2026-11): in the apps the sync token lives in the OS keystore
 * (`getPlatform().secrets`), not in IndexedDB `_secrets.syncConfig`. The record keeps everything
 * else (the service worker reads only the key from it). An old record is moved on the first load.
 * The PWA keeps IndexedDB (its secret store is the same origin's IndexedDB).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createBackup, serializeBackup } from '@/core/backup/backup';
import type { TaschenmesserDB } from '@/core/db/db';
import { getPlatform, setPlatform } from '@/core/platform';
import { deviceSecretNames } from '@/core/reset/device';
import type { SecretStore } from '@/core/secrets/types';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { createTestDb } from '@/test-utils';
import {
  connect,
  disconnect,
  loadSyncConfig,
  SYNC_TOKEN_SECRET,
  type SyncServiceDeps,
} from './service';
import { MemoryServer } from './testing';

const TOKEN = 'invented-token-for-the-test-123';

function store(protection: SecretStore['protection']): SecretStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    protection,
    map,
    get: async (n) => map.get(n),
    has: async (n) => map.has(n),
    set: async (n, v) => void map.set(n, v),
    delete: async (n) => void map.delete(n),
  };
}

let db: TaschenmesserDB;
let server: MemoryServer;
let deps: SyncServiceDeps;

const record = async () =>
  (
    await db
      .table<{ key: string; value: Record<string, unknown> }, string>('_secrets')
      .get('syncConfig')
  )?.value;

beforeEach(() => {
  db = createTestDb();
  server = new MemoryServer();
  deps = {
    database: db,
    storage: new DexieStorageAdapter(db),
    remote: (_url, token) => server.remote(token),
    kdf: { m: 8, t: 1, p: 1 },
  };
});
afterEach(async () => {
  setPlatform(undefined);
  db.close();
  await db.delete();
});

describe('sync token in the apps (OS keystore)', () => {
  it('connect keeps the token out of IndexedDB and in the secret store', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    expect(
      (await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps)).ok,
    ).toBe(true);
    const stored = await record();
    expect(stored?.url).toBe('https://sync.example');
    expect(JSON.stringify(stored)).not.toContain(TOKEN);
    expect(secrets.map.get(SYNC_TOKEN_SECRET)).toBe(TOKEN);
    const loaded = await loadSyncConfig(db);
    expect(loaded?.kind === 'selfHosted' && loaded.token).toBe(TOKEN);
  });

  it('an old record is moved on the first load: read old, write new, delete old', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    await db.table('_secrets').put({
      key: 'syncConfig',
      value: { kind: 'selfHosted', url: 'https://sync.example', token: TOKEN },
    });
    const loaded = await loadSyncConfig(db);
    expect(loaded?.kind === 'selfHosted' && loaded.token).toBe(TOKEN);
    expect(secrets.map.get(SYNC_TOKEN_SECRET)).toBe(TOKEN);
    expect(JSON.stringify(await record())).not.toContain(TOKEN);
  });

  it('a refusing keystore leaves the old record working', async () => {
    const secrets = store('os-keystore');
    secrets.set = async () => {
      throw new Error('keystore locked');
    };
    setPlatform({ ...getPlatform(), secrets });
    const old = { kind: 'selfHosted', url: 'https://sync.example', token: TOKEN };
    await db.table('_secrets').put({ key: 'syncConfig', value: old });
    const loaded = await loadSyncConfig(db);
    expect(loaded?.kind === 'selfHosted' && loaded.token).toBe(TOKEN);
    expect(await record()).toEqual(old);
  });

  it('disconnect removes the token from the secret store', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    await disconnect(deps);
    expect(secrets.map.has(SYNC_TOKEN_SECRET)).toBe(false);
    expect(await record()).toBeUndefined();
  });

  it('"Alle Daten löschen" knows the token name', async () => {
    expect(await deviceSecretNames(db)).toContain(SYNC_TOKEN_SECRET);
  });

  it('the token is never part of a backup', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    expect(serializeBackup(await createBackup(db))).not.toContain(TOKEN);
  });
});

describe('sync token in the PWA (device-key store = the same IndexedDB)', () => {
  it('stays in the record; the secret store is not used', async () => {
    const secrets = store('device-key');
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    expect((await record())?.token).toBe(TOKEN);
    expect(secrets.map.size).toBe(0);
  });
});
