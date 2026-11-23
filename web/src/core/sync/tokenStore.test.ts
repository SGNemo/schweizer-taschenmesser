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
import { SYNC_TOKEN_SECRET } from './names';
import { createMigratingStore } from '@/core/secrets/migrating';
import {
  connect,
  disconnect,
  loadSyncConfig,
  rotateThisDeviceToken,
  syncNow,
  type SyncServiceDeps,
} from './service';
import { useSyncStatus } from './status';
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

describe('sync token – edge cases (council round 1)', () => {
  it('a token moved earlier is found even on a start whose store is the device-key one', async () => {
    const shared = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets: shared });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    // Next start: the keystore probe failed; the device-key store answers (same entries here).
    setPlatform({ ...getPlatform(), secrets: { ...shared, protection: 'device-key' } });
    const loaded = await loadSyncConfig(db);
    expect(loaded?.kind === 'selfHosted' && loaded.token).toBe(TOKEN);
  });

  it('a missing token is reported as such, no empty token is sent', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    await db.table('_secrets').put({
      key: 'syncConfig',
      value: { kind: 'selfHosted', url: 'https://sync.example', token: '' },
    });
    let asked = false;
    await syncNow({
      ...deps,
      remote: (_url, token) => {
        asked = true;
        return server.remote(token);
      },
    });
    expect(asked).toBe(false);
    expect(useSyncStatus.getState().error).toBe('token-missing');
  });

  it('a refusing keystore at connect keeps the token in the record instead of losing it', async () => {
    const secrets = store('os-keystore');
    secrets.set = async () => {
      throw new Error('keystore locked');
    };
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    expect((await record())?.token).toBe(TOKEN);
  });

  it('the real store falls back to the device-key store when the keystore fails', async () => {
    const legacy = store('device-key');
    const failing = store('os-keystore');
    failing.set = async () => {
      throw new Error('keystore locked');
    };
    failing.get = async () => {
      throw new Error('keystore locked');
    };
    setPlatform({ ...getPlatform(), secrets: createMigratingStore(failing, legacy) });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    expect(JSON.stringify(await record())).not.toContain(TOKEN);
    const loaded = await loadSyncConfig(db);
    expect(loaded?.kind === 'selfHosted' && loaded.token).toBe(TOKEN);
  });

  it('a rotated token replaces the old one in the keystore', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    server.supportsDevices = true;
    await connect(
      { url: 'https://sync.example', token: TOKEN, encrypt: false, deviceName: 'PC' },
      deps,
    );
    const before = secrets.map.get(SYNC_TOKEN_SECRET);
    expect(await rotateThisDeviceToken(deps)).toBe(true);
    const after = secrets.map.get(SYNC_TOKEN_SECRET);
    expect(after).toBeTruthy();
    expect(after).not.toBe(before);
    expect(JSON.stringify(await record())).not.toContain(after!);
  });

  it('a move that is still running cannot bring back a connection that was just removed', async () => {
    const secrets = store('os-keystore');
    let entered!: () => void;
    const inSet = new Promise<void>((r) => (entered = r));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const plainSet = secrets.set;
    secrets.set = async (n, v) => {
      entered();
      await gate;
      return plainSet(n, v);
    };
    setPlatform({ ...getPlatform(), secrets });
    await db.table('_secrets').put({
      key: 'syncConfig',
      value: { kind: 'selfHosted', url: 'https://sync.example', token: TOKEN },
    });
    const loading = loadSyncConfig(db);
    await inSet; // the move is now inside the keystore write
    const removing = disconnect(deps);
    await new Promise((r) => setTimeout(r, 20)); // give a lock-free disconnect time to finish first
    release();
    await Promise.all([loading, removing]);
    expect(await record()).toBeUndefined();
    expect(secrets.map.has(SYNC_TOKEN_SECRET)).toBe(false);
  });

  it('replacing a server connection with the home network removes the token; a home-network save alone does not touch the store', async () => {
    const secrets = store('os-keystore');
    const deleted: string[] = [];
    const plainDelete = secrets.delete;
    secrets.delete = async (n) => {
      deleted.push(n);
      return plainDelete(n);
    };
    setPlatform({ ...getPlatform(), secrets });
    server = new MemoryServer();
    server.token = TOKEN;
    await connect({ url: 'https://sync.example', token: TOKEN, encrypt: false }, deps);
    const { saveSyncConfigForTest } = await import('./service');
    const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ]);
    await saveSyncConfigForTest(db, { kind: 'lanHub', key, keyVersion: 1 });
    expect(deleted).toEqual([SYNC_TOKEN_SECRET]);
    expect(secrets.map.has(SYNC_TOKEN_SECRET)).toBe(false);
    await saveSyncConfigForTest(db, { kind: 'lanHub', key, keyVersion: 2 });
    expect(deleted).toEqual([SYNC_TOKEN_SECRET]);
  });

  it('the new error has a text in both languages', async () => {
    const { t } = await import('@/strings');
    expect(t.sync.errors['token-missing']).toBeTruthy();
  });

  it('no request with an empty token: push, the feed proxy and the device list get no server', async () => {
    const secrets = store('os-keystore');
    setPlatform({ ...getPlatform(), secrets });
    await db.table('_secrets').put({
      key: 'syncConfig',
      value: { kind: 'selfHosted', url: 'https://sync.example', token: '' },
    });
    const { loadServerConfig } = await import('./service');
    expect(await loadServerConfig(db)).toBeUndefined();
  });
});
