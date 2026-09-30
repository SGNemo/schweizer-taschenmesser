import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRepo, type Repo } from '@/core/db/repo';
import type { Stored } from '@/core/db/types';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from '@/core/db/db';
import { decryptOps, deriveKey, isEncrypted, newSalt } from './crypto';
import { runSync } from './engine';
import { MemoryServer } from './testing';

const example = allManifests.find((m) => m.id === 'example')!;
const schema = example.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean; note?: string };

interface Device {
  db: TaschenmesserDB;
  repo: Repo<Entry>;
  storage: DexieStorageAdapter;
  sync: (opts?: {
    key?: CryptoKey;
    pullLimit?: number;
    pushRecords?: number;
  }) => ReturnType<typeof runSync>;
}

let clock = 1_800_000_000_000;
let server: MemoryServer;
const devices: Device[] = [];

function device(): Device {
  const db = createTestDb();
  const storage = new DexieStorageAdapter(db);
  const repo = createRepo('example_entry', schema, db) as unknown as Repo<Entry>;
  const d: Device = {
    db,
    repo,
    storage,
    sync: (opts = {}) => runSync({ storage, adapter: server.adapter(), ...opts }),
  };
  devices.push(d);
  return d;
}

const titles = async (d: Device) => (await d.repo.active().toArray()).map((e) => e.title).sort();

beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10)); // every "now" moves forward so stamps are distinct
  server = new MemoryServer();
});
afterEach(async () => {
  setNow();
  for (const d of devices.splice(0)) {
    d.db.close();
    await d.db.delete();
  }
});

describe('two devices through a server', () => {
  it('records created on A show up on B with identical stamps; the outbox is cleared', async () => {
    const a = device();
    const b = device();
    const r = await a.repo.create({ title: 'Milch', done: false });
    await a.repo.update(r.id, { done: true });

    const first = await a.sync();
    expect(first).toMatchObject({ pushed: 1, fullUpload: true });
    expect(await a.storage.pendingCount()).toBe(0);
    await b.sync();

    const onB = (await b.repo.get(r.id)) as Stored<Entry>;
    const onA = (await a.repo.get(r.id)) as Stored<Entry>;
    expect(onB).toMatchObject({ title: 'Milch', done: true, deletedAt: null });
    expect(onB._f).toEqual(onA._f);
    expect(onB.deviceId).toBe(onA.deviceId);
    // Received data is not queued for pushing again.
    expect(await b.storage.pendingCount()).toBe(0);
  });

  it('concurrent edits of different fields merge on both devices', async () => {
    const a = device();
    const b = device();
    const r = await a.repo.create({ title: 'Brot', done: false });
    await a.sync();
    await b.sync();

    await a.repo.update(r.id, { title: 'Vollkornbrot' });
    await b.repo.update(r.id, { done: true, note: 'beim Bäcker' });
    await a.sync();
    await b.sync();
    await a.sync();

    for (const d of [a, b]) {
      expect(await d.repo.get(r.id)).toMatchObject({
        title: 'Vollkornbrot',
        done: true,
        note: 'beim Bäcker',
      });
    }
  });

  it('the same field edited on both devices: the later edit wins everywhere', async () => {
    const a = device();
    const b = device();
    const r = await a.repo.create({ title: 'x', done: false });
    await a.sync();
    await b.sync();

    await a.repo.update(r.id, { title: 'from A (earlier)' });
    await b.repo.update(r.id, { title: 'from B (later)' });
    await b.sync();
    await a.sync();
    await b.sync();

    expect((await a.repo.get(r.id))?.title).toBe('from B (later)');
    expect((await b.repo.get(r.id))?.title).toBe('from B (later)');
  });

  it('deletes propagate as tombstones and a later edit does not resurrect the record', async () => {
    const a = device();
    const b = device();
    const r = await a.repo.create({ title: 'weg', done: false });
    await a.sync();
    await b.sync();

    await a.repo.remove(r.id);
    await b.repo.update(r.id, { note: 'edit after (concurrent) delete' });
    await a.sync();
    await b.sync();
    await a.sync();

    expect(await a.repo.get(r.id)).toBeUndefined();
    expect(await b.repo.get(r.id)).toBeUndefined();
    const raw = await b.repo.table.get(r.id);
    expect(raw?.deletedAt).not.toBeNull();
    expect(raw?.note).toBe('edit after (concurrent) delete'); // field merged, record stays deleted
  });

  it('a removed optional field (undefined) is removed on the other device too', async () => {
    const a = device();
    const b = device();
    const r = await a.repo.create({ title: 't', done: false, note: 'n' });
    await a.sync();
    await b.sync();
    await a.repo.update(r.id, { note: undefined });
    await a.sync();
    await b.sync();
    expect('note' in ((await b.repo.get(r.id)) as object)).toBe(false);
  });

  it('a remote stamp from the future does not make later local edits lose (clock skew)', async () => {
    const a = device();
    const b = device();
    const r = await a.repo.create({ title: 'x', done: false });
    // A's clock is one hour ahead when it edits.
    clock += 3_600_000;
    await a.repo.update(r.id, { title: 'A, clock ahead' });
    await a.sync();
    clock -= 3_600_000;
    await b.sync();
    // B's own clock is behind, but after receiving A's stamp its edit must still win.
    await b.repo.update(r.id, { title: 'B, later in real time' });
    await b.sync();
    await a.sync();
    expect((await a.repo.get(r.id))?.title).toBe('B, later in real time');
  });

  it('pages through many ops with a small pull limit and pushes in several requests', async () => {
    const a = device();
    const b = device();
    for (let i = 0; i < 12; i++) await a.repo.create({ title: `n${i}`, done: false });
    const pushed = await a.sync({ pushRecords: 5 });
    expect(pushed.pushed).toBe(12);
    expect(server.requests.push).toBe(3);
    const pulled = await b.sync({ pullLimit: 7 });
    expect(pulled.pulled).toBeGreaterThanOrEqual(36);
    expect(await titles(b)).toEqual(await titles(a));
    expect(await b.storage.getCursor()).toBeGreaterThan(0);
  });

  it('a record edited again while its push was in flight is pushed again in the same round', async () => {
    const a = device();
    const r = await a.repo.create({ title: 'v1', done: false });
    server.onPush = async () => {
      server.onPush = undefined;
      await a.repo.update(r.id, { title: 'v2 (during push)' });
    };
    await a.sync();
    // First push was not acknowledged (rev changed), so the loop sent the record a second time.
    expect(server.requests.push).toBe(2);
    expect(await a.storage.pendingCount()).toBe(0);
    expect(server.dump().find((o) => o.field === 'title')?.value).toBe('v2 (during push)');
  });

  it('a network error leaves everything queued and the next sync succeeds', async () => {
    const a = device();
    await a.repo.create({ title: 'offline', done: false });
    server.online = false;
    await expect(a.sync()).rejects.toMatchObject({ code: 'network' });
    expect(await a.storage.pendingCount()).toBe(1);
    server.online = true;
    await a.sync();
    expect(await a.storage.pendingCount()).toBe(0);
  });

  it('a new or reset server receives everything the device has (epoch change)', async () => {
    const a = device();
    const b = device();
    await a.repo.create({ title: 'one', done: false });
    await a.repo.create({ title: 'two', done: false });
    await a.sync();
    await b.sync();

    server.reset(); // e.g. server database restored from an empty state
    expect(server.dump()).toHaveLength(0);
    const res = await b.sync();
    expect(res.fullUpload).toBe(true);
    expect(server.dump().length).toBeGreaterThan(0);
    const c = device();
    await c.sync();
    expect(await titles(c)).toEqual(['one', 'two']);
    // A learns about the reset too and re-uploads what it has (nothing new for the server).
    expect((await a.sync()).fullUpload).toBe(true);
    expect(await titles(a)).toEqual(['one', 'two']);
  });

  it('first contact uploads data that existed before sync was enabled', async () => {
    const a = device();
    await a.repo.create({ title: 'old local data', done: false });
    await a.storage.acknowledge((await a.storage.readOutbox(10)).entries); // pretend it was never queued
    expect(await a.storage.pendingCount()).toBe(0);
    await a.sync();
    expect(server.dump().some((o) => o.value === 'old local data')).toBe(true);
  });

  it('ignores ops for collections this app version does not know', async () => {
    const a = device();
    server.adapter().push([
      {
        collection: 'futuremodule_thing',
        id: 'x',
        field: 'name',
        hlc: '1900000000000-0000-zzzz0001',
        value: 'n',
      },
    ]);
    await a.repo.create({ title: 'known', done: false });
    await expect(a.sync()).resolves.toBeDefined();
    expect(await titles(a)).toEqual(['known']);
  });
});

describe('with end-to-end encryption', () => {
  const ITER = 1000;
  const salt = newSalt();

  it('the server only sees ciphertext; another device with the passphrase reads everything', async () => {
    const a = device();
    const b = device();
    const key = await deriveKey('a long shared passphrase', salt, ITER);
    const r = await a.repo.create({ title: 'Steuer-ID 12345', done: false, note: 'geheim' });
    await a.sync({ key });

    const stored = server.dump();
    expect(stored.length).toBeGreaterThan(3);
    expect(JSON.stringify(stored)).not.toMatch(/Steuer|geheim|12345/);
    expect(stored.every((o) => isEncrypted(o.value))).toBe(true);
    expect(stored.find((o) => o.field === 'title')).toMatchObject({
      collection: 'example_entry',
      id: r.id,
    });

    await b.sync({ key: await deriveKey('a long shared passphrase', salt, ITER) });
    expect(await b.repo.get(r.id)).toMatchObject({ title: 'Steuer-ID 12345', note: 'geheim' });
  });

  it('wrong passphrase → decrypt error and nothing is applied or the cursor advanced', async () => {
    const a = device();
    const b = device();
    await a.repo.create({ title: 'x', done: false });
    await a.sync({ key: await deriveKey('right passphrase', salt, ITER) });
    await expect(
      b.sync({ key: await deriveKey('wrong passphrase', salt, ITER) }),
    ).rejects.toMatchObject({ code: 'decrypt' });
    expect(await titles(b)).toEqual([]);
    expect(await b.storage.getCursor()).toBe(0);
  });

  it('encrypted data without a key is refused instead of being stored as garbage', async () => {
    const a = device();
    const b = device();
    await a.repo.create({ title: 'x', done: false });
    await a.sync({ key: await deriveKey('pass phrase 1', salt, ITER) });
    await expect(b.sync()).rejects.toMatchObject({ code: 'no-key' });
    expect(await titles(b)).toEqual([]);
  });

  it('ops on the server can be decrypted only with the right key and location', async () => {
    const a = device();
    await a.repo.create({ title: 'x', done: false });
    const key = await deriveKey('pass phrase 2', salt, ITER);
    await a.sync({ key });
    const { ops, rejected } = await decryptOps(key, server.dump());
    expect(rejected).toBe(0);
    expect(ops.find((o) => o.field === 'title')?.value).toBe('x');
  });
});
