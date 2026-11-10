import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepo, type Repo } from '@/core/db/repo';
import type { TaschenmesserDB } from '@/core/db/db';
import { allManifests } from '@/core/modules/registry';
import { createFakeLanHubParts } from '@/core/platform/fakeLanHub';
import type { LanClientService, LanHubService } from '@/core/platform/types';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { createTestDb } from '@/test-utils';
import { LanClientAdapter, LanHubAdapter, slices } from './adapters/lanHub';
import {
  connect,
  disableLanHub,
  enableLanHub,
  loadServerConfig,
  loadSyncConfig,
  pairWithPc,
  renewLanHubKey,
  syncNow,
  unpairFromPc,
  type SyncServiceDeps,
} from './service';
import { useSyncStatus } from './status';
import { MemoryServer } from './testing';
import { SyncError } from './types';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };

const dbs: TaschenmesserDB[] = [];
let fake: ReturnType<typeof createFakeLanHubParts>;

/** A desktop app on the hub PC (or a second PC sharing the hub process, which stands in for a client). */
function pc(hub: LanHubService = fake.hub) {
  const database = createTestDb();
  dbs.push(database);
  const deps: SyncServiceDeps = {
    database,
    storage: new DexieStorageAdapter(database),
    remote: () => new MemoryServer().remote('t'),
    lanHub: () => hub,
  };
  return {
    db: database,
    deps,
    repo: createRepo('example_entry', schema, database) as unknown as Repo<Entry>,
  };
}

beforeEach(() => {
  fake = createFakeLanHubParts();
  useSyncStatus.getState().set({
    phase: 'off',
    server: undefined,
    via: undefined,
    encrypted: false,
    error: undefined,
    pending: 0,
    failures: 0,
    retryAt: undefined,
    lastSyncAt: undefined,
  });
});
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

describe('LanHubAdapter', () => {
  it('sends the key version with every request and maps hub errors to calm codes', async () => {
    const bodies: string[] = [];
    const adapter = new LanHubAdapter(
      {
        request: async (body) => {
          bodies.push(body);
          return JSON.stringify({ error: 'stale-key-version' });
        },
      },
      7,
    );
    await expect(adapter.pull(0, 10)).rejects.toMatchObject({ code: 'server' });
    expect(JSON.parse(bodies[0]!)).toEqual({ keyVersion: 7, type: 'pull', since: 0, limit: 10 });

    const drift = new LanHubAdapter(
      { request: async () => JSON.stringify({ error: 'hlc-drift' }) },
      1,
    );
    await expect(drift.push([])).rejects.toMatchObject({ code: 'clock' });
  });

  it('treats a hub that is not running as "not reachable", and a malformed page as a server problem', async () => {
    const off = new LanHubAdapter({ request: () => Promise.reject(new Error('not-started')) }, 1);
    await expect(off.pull(0, 10)).rejects.toEqual(new SyncError('network'));
    const odd = new LanHubAdapter(
      { request: async () => JSON.stringify({ epoch: 'e', ops: 'x', cursor: -1 }) },
      1,
    );
    await expect(odd.pull(0, 10)).rejects.toMatchObject({ code: 'server' });
  });
});

describe('this PC as the home-network hub', () => {
  it('turns on, stores only an encrypted copy in the hub and a non-extractable key on the device', async () => {
    const a = pc();
    await a.repo.create({ title: 'Milch kaufen', done: false });
    expect(await enableLanHub(a.deps)).toEqual({ ok: true });

    const config = await loadSyncConfig(a.db);
    expect(config?.kind).toBe('lanHub');
    expect(config?.key?.extractable).toBe(false);
    expect(await loadServerConfig(a.db)).toBeUndefined();
    expect(useSyncStatus.getState()).toMatchObject({
      phase: 'idle',
      via: 'lanHub',
      encrypted: true,
    });
    expect(fake.hooks.opsCount()).toBeGreaterThan(0);
    expect(fake.hooks.allEncrypted()).toBe(true);
  });

  it('brings data from one device to another through the hub', async () => {
    const a = pc();
    const b = pc();
    await a.repo.create({ title: 'Vom PC', done: false });
    await enableLanHub(a.deps);
    await enableLanHub(b.deps);
    expect((await b.repo.active().toArray()).map((e) => e.title)).toEqual(['Vom PC']);
  });

  it('refuses while this device syncs through an own server (one path per device)', async () => {
    const server = new MemoryServer();
    const a = pc();
    a.deps.remote = (_url, token) => server.remote(token);
    expect(
      (await connect({ url: 'https://sync.example', token: 'right-token', encrypt: false }, a.deps))
        .ok,
    ).toBe(true);
    expect(await enableLanHub(a.deps)).toEqual({ ok: false, reason: 'server-connected' });
    expect((await loadSyncConfig(a.db))?.kind).toBe('selfHosted');
  });

  it('says "unsupported" where there is no hub, and "keystore" when the OS key store fails', async () => {
    const noHub = pc({ ...fake.hub, supported: false });
    expect(await enableLanHub(noHub.deps)).toEqual({ ok: false, reason: 'unsupported' });
    const broken = pc({
      ...fake.hub,
      start: () => Promise.reject(new Error('keystore-unavailable')),
    });
    expect(await enableLanHub(broken.deps)).toEqual({ ok: false, reason: 'keystore' });
    expect(await loadSyncConfig(broken.db)).toBeUndefined();
  });

  it('after "Schlüssel erneuern" uploads everything again under the new key version', async () => {
    const a = pc();
    await a.repo.create({ title: 'Eins', done: false });
    await enableLanHub(a.deps);
    const before = (await loadSyncConfig(a.db)) as { keyVersion: number };
    expect(await renewLanHubKey(a.deps)).toBe(true);
    const after = (await loadSyncConfig(a.db)) as { keyVersion: number };
    expect(after.keyVersion).toBe(before.keyVersion + 1);
    expect(fake.hooks.opsCount()).toBeGreaterThan(0);
    expect(fake.hooks.allEncrypted()).toBe(true);
  });

  it('picks up a key renewed elsewhere before the next round instead of failing', async () => {
    const a = pc();
    await enableLanHub(a.deps);
    await fake.hub.rotate(); // e.g. renewed from another window
    await a.repo.create({ title: 'Nach dem Erneuern', done: false });
    await syncNow(a.deps);
    expect(useSyncStatus.getState().phase).toBe('idle');
    const config = (await loadSyncConfig(a.db)) as { keyVersion: number };
    expect(config.keyVersion).toBe(2);
  });

  it('turning it off stops the hub and forgets the connection, the data stays', async () => {
    const a = pc();
    await a.repo.create({ title: 'Bleibt', done: false });
    await enableLanHub(a.deps);
    await disableLanHub(a.deps);
    expect(await loadSyncConfig(a.db)).toBeUndefined();
    expect((await fake.hub.status()).running).toBe(false);
    expect((await a.repo.active().toArray()).length).toBe(1);
    expect(useSyncStatus.getState()).toMatchObject({ phase: 'off', via: undefined });
  });
});

describe('a phone paired with the hub PC', () => {
  function phone(client = createFakeLanClientForTest()) {
    const p = pc();
    p.deps.lanClient = () => client.client;
    return { ...p, client };
  }

  it('pairs by QR (the code goes to the screen), then syncs encrypted through the hub', async () => {
    const hubPc = pc();
    await hubPc.repo.create({ title: 'Vom PC', done: false });
    await enableLanHub(hubPc.deps);

    const p = phone();
    await p.repo.create({ title: 'Vom Handy', done: false });
    const codes: string[] = [];
    const result = pairWithPc('NEMO1:qr', 'Android-Handy', (c) => codes.push(c), p.deps);
    await vi.waitFor(() => expect(codes).toEqual(['482913']));
    p.client.confirm(); // the user compared the code and tapped "Koppeln" on the PC
    expect(await result).toEqual({ ok: true });

    expect((await loadSyncConfig(p.db))?.kind).toBe('lanClient');
    expect((await loadSyncConfig(p.db))?.key?.extractable).toBe(false);
    // the first round runs in the background (the dialog closes at once)
    await vi.waitFor(async () =>
      expect((await p.repo.active().toArray()).map((e) => e.title).sort()).toHaveLength(2),
    );
    expect((await p.repo.active().toArray()).map((e) => e.title).sort()).toEqual([
      'Vom Handy',
      'Vom PC',
    ]);
    // Both entries are here once the pull is applied; the same round still pushes the phone's own
    // entry and stores its result after that, so "idle" comes later than the data.
    await vi.waitFor(() =>
      expect(useSyncStatus.getState()).toMatchObject({ phase: 'idle', via: 'lanClient' }),
    );
    expect(fake.hooks.allEncrypted()).toBe(true);
  });

  it('says why pairing did not work and keeps nothing', async () => {
    const p = phone();
    expect(await pairWithPc('hello', 'X', () => undefined, p.deps)).toEqual({
      ok: false,
      reason: 'bad-qr',
    });
    p.client.failNext('pairing-not-possible');
    expect(await pairWithPc('NEMO1:x', 'X', () => undefined, p.deps)).toEqual({
      ok: false,
      reason: 'pairing-not-possible',
    });
    expect(await loadSyncConfig(p.db)).toBeUndefined();
  });

  it('only an authenticated refusal makes it "revoked"; an unreachable PC stays a calm network state', async () => {
    const p = phone();
    const result = pairWithPc('NEMO1:qr', 'X', () => p.client.confirm(), p.deps);
    expect(await result).toEqual({ ok: true });
    p.client.unreachable = true;
    await syncNow(p.deps);
    expect(useSyncStatus.getState()).toMatchObject({ phase: 'error', error: 'network' });
    p.client.unreachable = false;
    p.client.refused = true;
    await syncNow(p.deps);
    expect(useSyncStatus.getState()).toMatchObject({ phase: 'error', error: 'revoked' });
  });

  it('unpairing forgets the connection and keeps the data', async () => {
    const p = phone();
    await p.repo.create({ title: 'Bleibt', done: false });
    expect(await pairWithPc('NEMO1:qr', 'X', () => p.client.confirm(), p.deps)).toEqual({
      ok: true,
    });
    await unpairFromPc(p.deps);
    expect(await loadSyncConfig(p.db)).toBeUndefined();
    expect(p.client.unpaired).toBe(true);
    expect((await p.repo.active().toArray()).length).toBe(1);
  });
});

describe('a second PC: one path per device', () => {
  function secondPc() {
    const p = pc();
    const client = createFakeLanClientForTest();
    p.deps.lanClient = () => client.client;
    return { ...p, client };
  }

  it('a PC paired as a client never turns on its own hub', async () => {
    const hubPc = pc();
    await enableLanHub(hubPc.deps);
    const p = secondPc();
    expect(await pairWithPc('NEMO1:qr', 'Windows-PC', () => p.client.confirm(), p.deps)).toEqual({
      ok: true,
    });
    const start = vi.spyOn(fake.hub, 'start');
    expect(await enableLanHub(p.deps)).toEqual({ ok: false, reason: 'client-paired' });
    expect(start).not.toHaveBeenCalled();
    expect((await loadSyncConfig(p.db))?.kind).toBe('lanClient');
  });

  it('the hub PC never pairs as a client of another PC', async () => {
    const p = secondPc();
    await enableLanHub(p.deps);
    const pair = vi.spyOn(p.client.client, 'pair');
    expect(await pairWithPc('NEMO1:qr', 'Windows-PC', () => undefined, p.deps)).toEqual({
      ok: false,
      reason: 'hub-on',
    });
    expect(pair).not.toHaveBeenCalled();
    expect((await loadSyncConfig(p.db))?.kind).toBe('lanHub');
  });

  it('keeps the shell refusals: hub-on from pairing, client-paired from the hub start', async () => {
    const p = secondPc();
    p.client.failNext('hub-on');
    expect(await pairWithPc('NEMO1:qr', 'Windows-PC', () => undefined, p.deps)).toEqual({
      ok: false,
      reason: 'hub-on',
    });
    const refusing = pc({
      ...fake.hub,
      start: () => Promise.reject(new Error('client-paired')),
    });
    expect(await enableLanHub(refusing.deps)).toEqual({ ok: false, reason: 'client-paired' });
    expect(await loadSyncConfig(refusing.db)).toBeUndefined();
  });
});

/** A device client in front of the shared fake hub (stands in for `lan_client.rs`). */
function createFakeLanClientForTest() {
  let resolveConfirm: (() => void) | undefined;
  let failNext: string | undefined;
  const state = {
    unreachable: false,
    refused: false,
    unpaired: false,
    confirm: () => resolveConfirm?.(),
    failNext: (code: string) => {
      failNext = code;
    },
    client: undefined as unknown as LanClientService,
  };
  state.client = {
    supported: true,
    scan: async () => 'NEMO1:qr',
    pair: async (qr, _name, onCode) => {
      if (!qr.startsWith('NEMO1:')) throw new Error('bad-qr');
      if (failNext) {
        const code = failNext;
        failNext = undefined;
        throw new Error(code);
      }
      const { dataKey } = await fake.hub.start();
      const confirmed = new Promise<void>((r) => (resolveConfirm = r));
      onCode('482913');
      await confirmed;
      return { ...dataKey, hub: 'ab'.repeat(32) };
    },
    cancelPair: async () => undefined,
    request: async (body) => {
      if (state.unreachable) throw new Error('network');
      if (state.refused) throw new Error('unknown-device');
      return fake.hub.request(body);
    },
    unpair: async () => {
      state.unpaired = true;
    },
  };
  return state;
}

describe('requests that fit one frame', () => {
  const op = (i: number, size: number) => ({
    collection: 'todos_task',
    id: `r${i}`,
    field: 'title',
    hlc: `1790000000000-0000-dev${i}`,
    value: `enc:v1:${'a'.repeat(size)}`,
  });

  it('slices pushes under the budget; an op larger than the budget goes alone', () => {
    const ops = [op(1, 100), op(2, 100), op(3, 70_000), op(4, 100)];
    const parts = slices(ops, 1_000);
    expect(parts.map((p) => p.map((o) => o.id))).toEqual([['r1', 'r2'], ['r3'], ['r4']]);
    for (const p of parts.filter((x) => x.length > 1))
      expect(JSON.stringify({ keyVersion: 1, type: 'push', ops: p }).length).toBeLessThan(1_000);
  });

  it('halves the page after response-too-large and remembers what fitted', async () => {
    const asked: number[] = [];
    const adapter = new LanClientAdapter(
      {
        request: async (body) => {
          const { limit } = JSON.parse(body) as { limit: number };
          asked.push(limit);
          return JSON.stringify(
            limit > 50
              ? { error: 'response-too-large' }
              : { epoch: 'e', ops: [], cursor: 0, more: false },
          );
        },
      },
      1,
    );
    await adapter.pull(0, 1000);
    expect(asked).toEqual([200, 100, 50]);
    asked.length = 0;
    await adapter.pull(0, 1000);
    // starts near the last size that fitted instead of at 200 again
    expect(asked[0]).toBe(75);
  });
});

describe('pairing that cannot be kept', () => {
  it('undoes the pairing on the PC when an own server got connected meanwhile', async () => {
    const server = new MemoryServer();
    const p = pc();
    p.deps.remote = (_url, token) => server.remote(token);
    const client = createFakeLanClientForTest();
    p.deps.lanClient = () => client.client;
    const result = pairWithPc(
      'NEMO1:qr',
      'X',
      () =>
        void connect(
          { url: 'https://sync.example', token: 'right-token', encrypt: false },
          p.deps,
        ).then(() => client.confirm()),
      p.deps,
    );
    expect(await result).toEqual({ ok: false, reason: 'failed' });
    expect(client.unpaired).toBe(true);
    expect((await loadSyncConfig(p.db))?.kind).toBe('selfHosted');
  });
});
