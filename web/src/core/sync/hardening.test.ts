import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import {
  countOpenConflicts,
  dismissConflict,
  listConflicts,
  purgeConflicts,
  restoreConflict,
  MAX_CONFLICT_VALUE_CHARS,
} from './conflicts';
import { chunkOps, runSync } from './engine';
import {
  backoffMs,
  connect,
  disconnect,
  fetchDevices,
  loadSyncConfig,
  lockDevice,
  rotateThisDeviceToken,
  runMaintenance,
  signOutThisDevice,
  syncNow,
  type SyncServiceDeps,
} from './service';
import { useSyncStatus } from './status';
import { MemoryServer } from './testing';
import { purgeTombstones, TOMBSTONE_RETENTION_MS } from './tombstones';
import type { FieldOp } from './types';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean; note?: string };
const tableNames = syncedTableNames(allManifests);
const DAY = 24 * 3600_000;

interface Dev {
  db: TaschenmesserDB;
  repo: Repo<Entry>;
  storage: DexieStorageAdapter;
  deps: SyncServiceDeps;
}

let server: MemoryServer;
const dbs: TaschenmesserDB[] = [];
let clock = 1_800_000_000_000;

function dev(): Dev {
  const db = createTestDb();
  dbs.push(db);
  const storage = new DexieStorageAdapter(db);
  return {
    db,
    storage,
    repo: createRepo('example_entry', schema, db) as unknown as Repo<Entry>,
    deps: { database: db, storage, remote: (_u, t) => server.remote(t), kdf: { m: 8, t: 1, p: 1 } },
  };
}
const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };
const sync = (d: Dev) => runSync({ storage: d.storage, adapter: server.adapter() });
const titles = async (d: Dev) => (await d.repo.active().toArray()).map((e) => e.title).sort();

beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
  server = new MemoryServer();
  server.supportsDevices = true;
  useSyncStatus.getState().set({
    phase: 'off',
    error: undefined,
    pending: 0,
    failures: 0,
    rejected: 0,
    retryAt: undefined,
    errorAt: undefined,
    lastSyncAt: undefined,
  });
});
afterEach(async () => {
  setNow();
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

describe('devices', () => {
  it('registers the device and keeps only its own token, never the shared one', async () => {
    const a = dev();
    expect(await connect({ ...params, deviceName: 'Laptop' }, a.deps)).toEqual({
      ok: true,
      encrypted: false,
    });
    const config = await loadSyncConfig(a.db);
    expect(config?.deviceName).toBe('Laptop');
    expect(config?.deviceId).toBeTruthy();
    expect(config?.token).not.toBe('right-token');
    expect(JSON.stringify(config?.token)).toMatch(/^"device-token-/);
    expect(useSyncStatus.getState().phase).toBe('idle');

    const list = await fetchDevices(a.deps);
    expect(list).toEqual([expect.objectContaining({ name: 'Laptop', current: true })]);
  });

  it('a legacy server (no protocol 2) keeps working with the shared token', async () => {
    server.supportsDevices = false;
    const a = dev();
    await connect(params, a.deps);
    expect((await loadSyncConfig(a.db))?.token).toBe('right-token');
    expect(await fetchDevices(a.deps)).toBeUndefined();
  });

  it('connecting again with the same device rotates its token instead of failing', async () => {
    const a = dev();
    await connect(params, a.deps);
    const first = (await loadSyncConfig(a.db))!.token;
    await disconnect(a.deps);
    expect((await connect(params, a.deps)).ok).toBe(true);
    const second = (await loadSyncConfig(a.db))!.token;
    expect(second).not.toBe(first);
    expect(useSyncStatus.getState().phase).toBe('idle');
  });

  it('a locked device is refused, stops retrying and keeps its local data', async () => {
    const a = dev();
    const b = dev();
    await connect({ ...params, deviceName: 'Handy' }, a.deps);
    await connect({ ...params, deviceName: 'Laptop' }, b.deps);
    const phone = (await loadSyncConfig(a.db))!.deviceId!;
    await a.repo.create({ title: 'lokal', done: false });

    expect(await lockDevice(phone, b.deps)).toBe(true);
    await syncNow(a.deps);
    const status = useSyncStatus.getState();
    expect(status).toMatchObject({ phase: 'error', error: 'revoked' });
    expect(status.retryAt).toBeUndefined(); // needs the user, not another attempt
    expect(await titles(a)).toEqual(['lokal']);

    // the laptop is unaffected and sees the lock
    const list = await fetchDevices(b.deps);
    expect(list!.find((d) => d.id === phone)!.revokedAt).not.toBeNull();
    expect((await connect({ ...params, deviceName: 'Handy neu' }, a.deps)).ok).toBe(true);
  });

  it('signing out revokes the token on the server and disconnects', async () => {
    const a = dev();
    const b = dev();
    await connect(params, a.deps);
    await connect(params, b.deps);
    const token = (await loadSyncConfig(a.db))!.token;
    await signOutThisDevice(a.deps);
    expect(await loadSyncConfig(a.db)).toBeUndefined();
    await expect(server.remote(token).getVault()).rejects.toMatchObject({ code: 'revoked' });
  });

  it('rotating the token replaces it and the old one is dead', async () => {
    const a = dev();
    await connect(params, a.deps);
    const old = (await loadSyncConfig(a.db))!.token;
    expect(await rotateThisDeviceToken(a.deps)).toBe(true);
    expect((await loadSyncConfig(a.db))!.token).not.toBe(old);
    await expect(server.remote(old).getVault()).rejects.toBeDefined();
    await syncNow(a.deps);
    expect(useSyncStatus.getState().phase).toBe('idle');
  });
});

describe('vault v2 (Argon2id)', () => {
  it('creates a v2 vault with KDF parameters and lets a second device join', async () => {
    const a = dev();
    const b = dev();
    expect(
      await connect({ ...params, encrypt: true, passphrase: 'long enough phrase' }, a.deps),
    ).toEqual({
      ok: true,
      encrypted: true,
    });
    expect(server.vault).toMatchObject({ v: 2, kdf: { alg: 'argon2id', m: 8, t: 1, p: 1 } });
    expect(server.vault!.check.startsWith('enc:v1:')).toBe(true);

    await a.repo.create({ title: 'geheim', done: false });
    await syncNow(a.deps);
    expect(JSON.stringify(server.dump())).not.toContain('geheim');

    expect(await connect({ ...params, passphrase: 'wrong phrase here' }, b.deps)).toEqual({
      ok: false,
      reason: 'wrong-passphrase',
    });
    expect((await connect({ ...params, passphrase: 'long enough phrase' }, b.deps)).ok).toBe(true);
    expect(await titles(b)).toEqual(['geheim']);
  });

  it('refuses an old PBKDF2 vault instead of falling back', async () => {
    server.vault = { salt: 'c2FsdHNhbHRzYWx0c2FsdA==', check: 'enc:v1:AAAA:BBBB' };
    const a = dev();
    expect(await connect({ ...params, passphrase: 'long enough phrase' }, a.deps)).toEqual({
      ok: false,
      reason: 'vault-outdated',
    });
    expect(await loadSyncConfig(a.db)).toBeUndefined();
  });

  it('refuses KDF parameters that are too weak or absurdly expensive (hostile server)', async () => {
    const a = dev();
    for (const kdf of [
      { alg: 'argon2id' as const, m: 8, t: 1, p: 1 },
      { alg: 'argon2id' as const, m: 4_000_000, t: 1, p: 1 },
    ]) {
      server.vault = { salt: 'c2FsdHNhbHRzYWx0c2FsdA==', check: 'enc:v1:AAAA:BBBB', v: 2, kdf };
      const result = await connect({ ...params, passphrase: 'long enough phrase' }, a.deps);
      // tiny parameters are only accepted in test mode; the huge one must always be rejected
      if (kdf.m > 1_048_576) expect(result).toEqual({ ok: false, reason: 'server-error' });
    }
  });
});

describe('retry with backoff', () => {
  it('grows 5 s → 5 min with jitter', () => {
    const mid = () => 0.5;
    expect([1, 2, 3, 4, 5, 6, 7, 10].map((n) => backoffMs(n, mid))).toEqual([
      5000, 10_000, 20_000, 40_000, 80_000, 160_000, 300_000, 300_000,
    ]);
    expect(backoffMs(1, () => 0)).toBe(4000);
    expect(backoffMs(1, () => 1)).toBe(6000);
  });

  it('a network failure schedules a retry, keeps the outbox, and a success resets everything', async () => {
    const a = dev();
    await connect(params, a.deps);
    await a.repo.create({ title: 'x', done: false });
    server.online = false;
    await syncNow(a.deps);
    let s = useSyncStatus.getState();
    expect(s).toMatchObject({ phase: 'error', error: 'network', failures: 1, pending: 1 });
    expect(s.retryAt).toBeGreaterThan(s.errorAt!);
    await syncNow(a.deps);
    expect(useSyncStatus.getState().failures).toBe(2);
    expect(useSyncStatus.getState().retryAt! - useSyncStatus.getState().errorAt!).toBeGreaterThan(
      7000,
    );

    server.online = true;
    await syncNow(a.deps);
    s = useSyncStatus.getState();
    expect(s).toMatchObject({ phase: 'idle', failures: 0, pending: 0 });
    expect(s.retryAt).toBeUndefined();
    expect(s.lastResult).toMatchObject({ pushed: 1 });
  });
});

describe('large data and interruptions', () => {
  it('splits big pushes into bounded requests', () => {
    const ops: FieldOp[] = Array.from({ length: 5001 }, (_, i) => ({
      collection: 'example_entry',
      id: `r${i}`,
      field: 'title',
      hlc: '1800000000000-0000-aaaa0001',
      value: 'x',
    }));
    const chunks = chunkOps(ops);
    expect(chunks.map((c) => c.length)).toEqual([2000, 2000, 1001]);
    expect(chunks.flat()).toHaveLength(5001);
    const big = ops.slice(0, 5).map((o) => ({ ...o, value: 'y'.repeat(1_000_000) }));
    expect(chunkOps(big).every((c) => c.length <= 2)).toBe(true);
  });

  it(
    'uploads hundreds of records in batches, without duplicates',
    { timeout: 90_000 },
    async () => {
      const a = dev();
      const b = dev();
      await a.repo.createMany(
        Array.from({ length: 600 }, (_, i) => ({ data: { title: `t${i}`, done: false } })),
      );
      await runSync({ storage: a.storage, adapter: server.adapter(), pushRecords: 100 });
      expect(server.requests.push).toBeGreaterThanOrEqual(6);
      expect(server.maxPushOps).toBeLessThanOrEqual(2000);
      expect(server.dump().filter((o) => o.field === 'title')).toHaveLength(600);
      await runSync({ storage: b.storage, adapter: server.adapter(), pullLimit: 250 });
      expect((await b.repo.active().toArray()).length).toBe(600);
      // syncing again changes nothing
      const before = JSON.stringify(server.dump());
      await runSync({ storage: a.storage, adapter: server.adapter() });
      expect(JSON.stringify(server.dump())).toBe(before);
    },
  );

  it('resumes an interrupted first upload and ends with exactly the same server state', async () => {
    const a = dev();
    await a.repo.createMany(
      Array.from({ length: 300 }, (_, i) => ({ data: { title: `t${i}`, done: false } })),
    );
    server.failPushAt = server.requests.push + 2; // dies in the middle of the upload
    await expect(
      runSync({ storage: a.storage, adapter: server.adapter(), pushRecords: 100 }),
    ).rejects.toMatchObject({
      code: 'network',
    });
    const half = server.dump().filter((o) => o.field === 'title').length;
    expect(half).toBeGreaterThan(0);
    expect(half).toBeLessThan(300);
    expect(await a.storage.pendingCount()).toBeGreaterThan(0);

    await runSync({ storage: a.storage, adapter: server.adapter(), pushRecords: 100 });
    expect(server.dump().filter((o) => o.field === 'title')).toHaveLength(300);
    expect(await a.storage.pendingCount()).toBe(0);
    const ids = server
      .dump()
      .filter((o) => o.field === 'title')
      .map((o) => o.id);
    expect(new Set(ids).size).toBe(300);
  });

  it('resumes an interrupted download from the last applied page', async () => {
    const a = dev();
    const b = dev();
    await a.repo.createMany(
      Array.from({ length: 300 }, (_, i) => ({ data: { title: `t${i}`, done: false } })),
    );
    await sync(a);
    const requestsBefore = server.requests.pull;
    server.failPullAt = requestsBefore + 2;
    await expect(
      runSync({ storage: b.storage, adapter: server.adapter(), pullLimit: 200 }),
    ).rejects.toMatchObject({
      code: 'network',
    });
    const cursor = await b.storage.getCursor();
    expect(cursor).toBeGreaterThan(0); // page 1 was applied and remembered
    await runSync({ storage: b.storage, adapter: server.adapter(), pullLimit: 200 });
    expect((await b.repo.active().toArray()).length).toBe(300);
  });
});

describe('conflicts (where last-write-wins decided)', () => {
  async function twoDevices() {
    const a = dev();
    const b = dev();
    const r = await a.repo.create({ title: 'Original', done: false });
    await sync(a);
    await sync(b);
    return { a, b, r };
  }

  it('logs the overwritten local value, lets you restore it, and syncs the restore', async () => {
    const { a, b, r } = await twoDevices();
    // both edit the same field while offline; b's edit is newer
    await a.repo.update(r.id, { title: 'A offline' });
    await b.repo.update(r.id, { title: 'B offline' });
    await sync(b);
    await sync(a); // a pulls b's newer value while its own edit is still unsynced

    expect((await a.repo.get(r.id))?.title).toBe('B offline');
    const open = await listConflicts(a.db);
    expect(open).toHaveLength(1);
    expect(open[0]).toMatchObject({
      collection: 'example_entry',
      recordId: r.id,
      field: 'title',
      kept: 'remote',
      lostValue: 'A offline',
      keptValue: 'B offline',
      status: 'open',
    });
    expect(open[0]!.remoteDevice).toBeTruthy();
    expect(await countOpenConflicts(a.db)).toBe(1);

    expect(await restoreConflict(open[0]!.id!, a.db)).toBe('restored');
    expect((await a.repo.get(r.id))?.title).toBe('A offline');
    expect(await countOpenConflicts(a.db)).toBe(0);
    // restoring queues the change; the other device receives it, and nothing loops back as a conflict
    await sync(a);
    await sync(b);
    expect((await b.repo.get(r.id))?.title).toBe('A offline');
    expect(await listConflicts(b.db)).toHaveLength(0);
    expect(await restoreConflict(open[0]!.id!, a.db)).toBe('already-current');
  });

  it('also logs the remote value that lost against a newer unsynced local edit', async () => {
    const { a, b, r } = await twoDevices();
    await b.repo.update(r.id, { title: 'B alt' });
    await sync(b);
    await a.repo.update(r.id, { title: 'A neuer' }); // newer stamp, not synced yet
    await sync(a);
    expect((await a.repo.get(r.id))?.title).toBe('A neuer');
    const [c] = await listConflicts(a.db);
    expect(c).toMatchObject({ kept: 'local', keptValue: 'A neuer', lostValue: 'B alt' });
    // restoring the other device's value is possible too
    expect(await restoreConflict(c!.id!, a.db)).toBe('restored');
    expect((await a.repo.get(r.id))?.title).toBe('B alt');
  });

  it('logs no conflict for ordinary sequential edits, equal values, or restores', async () => {
    const { a, b, r } = await twoDevices();
    await a.repo.update(r.id, { title: 'A1' });
    await sync(a);
    await sync(b); // b had no unsynced edit: a normal update
    await b.repo.update(r.id, { title: 'B1' });
    await sync(b);
    await sync(a);
    expect(await listConflicts(a.db)).toHaveLength(0);
    expect(await listConflicts(b.db)).toHaveLength(0);

    // both set the same value: nothing was lost
    await a.repo.update(r.id, { title: 'gleich' });
    await b.repo.update(r.id, { title: 'gleich' });
    await sync(a);
    await sync(b);
    expect(await listConflicts(b.db)).toHaveLength(0);
  });

  it('records an edit against a delete and can bring the record back', async () => {
    const { a, b, r } = await twoDevices();
    await a.repo.update(r.id, { title: 'A bearbeitet' });
    await b.repo.remove(r.id);
    await sync(b);
    await sync(a);
    expect(await a.repo.get(r.id)).toBeUndefined(); // the (newer) delete won
    const conflicts = await listConflicts(a.db);
    const del = conflicts.find((c) => c.field === 'deletedAt')!;
    expect(del).toMatchObject({ kept: 'remote', lostValue: null });
    expect(await restoreConflict(del.id!, a.db)).toBe('restored');
    expect((await a.repo.get(r.id))?.title).toBe('A bearbeitet');
  });

  it('never stores huge values, dismisses, and purges old entries', async () => {
    const { a, b, r } = await twoDevices();
    await a.repo.update(r.id, { note: 'x'.repeat(MAX_CONFLICT_VALUE_CHARS + 1) });
    await b.repo.update(r.id, { note: 'kurz' });
    await sync(b);
    await sync(a);
    const [c] = await listConflicts(a.db);
    expect(c).toMatchObject({ truncated: true, lostValue: null });
    expect(await restoreConflict(c!.id!, a.db)).toBe('not-restorable');
    await dismissConflict(c!.id!, a.db);
    expect(await countOpenConflicts(a.db)).toBe(0);
    expect(await purgeConflicts(a.db, clock + 31 * DAY)).toBe(1);
    expect(await listConflicts(a.db, 'dismissed')).toHaveLength(0);
  });

  it('a restored record that was purged meanwhile is reported, not recreated', async () => {
    const { a, b, r } = await twoDevices();
    await a.repo.update(r.id, { title: 'A' });
    await b.repo.update(r.id, { title: 'B' });
    await sync(b);
    await sync(a);
    const [c] = await listConflicts(a.db);
    await a.db.table('example_entry').delete(r.id);
    expect(await restoreConflict(c!.id!, a.db)).toBe('record-gone');
    expect(await a.db.table('example_entry').get(r.id)).toBeUndefined();
  });
});

describe('tombstone cleanup', () => {
  it('removes old synced tombstones only, keeps young, live and unsynced ones', async () => {
    const a = dev();
    const old = await a.repo.create({ title: 'alt gelöscht', done: false });
    const young = await a.repo.create({ title: 'jung gelöscht', done: false });
    const live = await a.repo.create({ title: 'lebt', done: false });
    const unsynced = await a.repo.create({ title: 'noch nicht gesendet', done: false });
    await a.repo.remove(old.id);
    await a.repo.remove(young.id);
    await sync(a);
    await a.repo.remove(unsynced.id); // stays in the outbox

    const later = clock + TOMBSTONE_RETENTION_MS + DAY;
    // the young one is deleted "later" so it is still inside the retention period
    await a.db.table('example_entry').update(young.id, { deletedAt: later - DAY });
    await a.db
      .table('example_entry')
      .update(unsynced.id, { deletedAt: later - TOMBSTONE_RETENTION_MS - DAY });

    expect(await purgeTombstones(a.db, tableNames, later)).toBe(1);
    const left = (await a.db.table('example_entry').toArray()).map((r) => r.id).sort();
    expect(left).toEqual([young.id, live.id, unsynced.id].sort());
  });

  it('maintenance runs only after a successful sync and at most once a day', async () => {
    const a = dev();
    await connect(params, a.deps);
    const r = await a.repo.create({ title: 'weg', done: false });
    await a.repo.remove(r.id);
    await syncNow(a.deps);

    const oldStamp = clock - TOMBSTONE_RETENTION_MS - DAY;
    await a.db.table('example_entry').update(r.id, { deletedAt: oldStamp });

    useSyncStatus.getState().set({ phase: 'error' });
    await runMaintenance(a.deps);
    expect(await a.db.table('example_entry').get(r.id)).toBeDefined(); // not while sync is failing

    useSyncStatus.getState().set({ phase: 'idle', lastSyncAt: clock });
    await runMaintenance(a.deps);
    expect(await a.db.table('example_entry').get(r.id)).toBeUndefined();
  });
});

describe('no secrets in sync payloads', () => {
  it('device-local secrets, tokens and keys never reach the server', async () => {
    const a = dev();
    await connect({ ...params, encrypt: true, passphrase: 'long enough phrase' }, a.deps);
    await a.db.table('_secrets').put({ key: 'secret:ai.claude', value: 'sk-test-fake-key' });
    await a.repo.create({ title: 'normal', done: false });
    await syncNow(a.deps);
    const token = (await loadSyncConfig(a.db))!.token;
    const wire = JSON.stringify(server.dump());
    for (const needle of [
      'sk-test-fake-key',
      token,
      'right-token',
      'long enough phrase',
      'syncConfig',
    ])
      expect(wire).not.toContain(needle);
    expect(server.dump().every((o) => tableNames.includes(o.collection))).toBe(true);
    // the vault check on the server is ciphertext, not the passphrase
    expect(JSON.stringify(server.vault)).not.toContain('long enough phrase');
  });
});
