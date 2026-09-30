import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from '@/core/db/db';
import {
  connect,
  disconnect,
  loadSyncConfig,
  resetServer,
  restoreSyncStatus,
  syncNow,
  type SyncServiceDeps,
} from './service';
import { useSyncStatus } from './status';
import { MemoryServer } from './testing';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };

let server: MemoryServer;
let db: TaschenmesserDB;
let repo: Repo<Entry>;
let deps: SyncServiceDeps;
const dbs: TaschenmesserDB[] = [];

function device(): { db: TaschenmesserDB; repo: Repo<Entry>; deps: SyncServiceDeps } {
  const database = createTestDb();
  dbs.push(database);
  return {
    db: database,
    repo: createRepo('example_entry', schema, database) as unknown as Repo<Entry>,
    deps: {
      database,
      storage: new DexieStorageAdapter(database),
      remote: (_url, token) => server.remote(token),
      kdf: { m: 8, t: 1, p: 1 },
    },
  };
}

const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };

beforeEach(() => {
  server = new MemoryServer();
  ({ db, repo, deps } = device());
  useSyncStatus.getState().set({
    phase: 'off',
    server: undefined,
    encrypted: false,
    error: undefined,
    pending: 0,
    lastSyncAt: undefined,
  });
});
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

describe('connect', () => {
  it('rejects bad URLs and unreachable, unauthorised or broken servers with a reason', async () => {
    expect(await connect({ ...params, url: 'ftp://x' }, deps)).toEqual({
      ok: false,
      reason: 'invalid-url',
    });
    expect(await connect({ ...params, url: 'not a url' }, deps)).toEqual({
      ok: false,
      reason: 'invalid-url',
    });
    expect(await connect({ ...params, token: '  ' }, deps)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
    expect(await connect({ ...params, token: 'wrong' }, deps)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
    server.online = false;
    expect(await connect(params, deps)).toEqual({ ok: false, reason: 'unreachable' });
    expect(await loadSyncConfig(db)).toBeUndefined();
    expect(useSyncStatus.getState().phase).toBe('off');
  });

  it('stores the configuration, runs the first sync and uploads existing data', async () => {
    await repo.create({ title: 'schon da', done: false });
    expect(await connect({ ...params, url: 'https://sync.example/' }, deps)).toEqual({
      ok: true,
      encrypted: false,
    });
    expect(await loadSyncConfig(db)).toMatchObject({
      url: 'https://sync.example',
      token: 'right-token',
      key: undefined,
    });
    expect(server.dump().some((o) => o.value === 'schon da')).toBe(true);
    expect(useSyncStatus.getState()).toMatchObject({
      phase: 'idle',
      server: 'sync.example',
      encrypted: false,
      pending: 0,
    });
    expect(useSyncStatus.getState().lastSyncAt).toBeTypeOf('number');
  });

  it('starts encryption on an empty server, another device joins with the passphrase', async () => {
    await repo.create({ title: 'Geheimnis', done: false });
    const first = await connect(
      { ...params, encrypt: true, passphrase: 'a long passphrase' },
      deps,
    );
    expect(first).toEqual({ ok: true, encrypted: true });
    expect(server.vault).not.toBeNull();
    expect(JSON.stringify(server.dump())).not.toContain('Geheimnis');

    const other = device();
    // The server already has a vault → passphrase needed, whatever the checkbox says.
    expect(await connect(params, other.deps)).toEqual({ ok: false, reason: 'passphrase-required' });
    expect(await connect({ ...params, passphrase: 'wrong passphrase' }, other.deps)).toEqual({
      ok: false,
      reason: 'wrong-passphrase',
    });
    expect(await connect({ ...params, passphrase: 'a long passphrase' }, other.deps)).toEqual({
      ok: true,
      encrypted: true,
    });
    expect((await other.repo.active().toArray()).map((e) => e.title)).toEqual(['Geheimnis']);
  });

  it('validates the passphrase length and refuses encryption on a server that already has plain data', async () => {
    expect(await connect({ ...params, encrypt: true, passphrase: 'short' }, deps)).toEqual({
      ok: false,
      reason: 'passphrase-too-short',
    });
    expect(await connect({ ...params, encrypt: true }, deps)).toEqual({
      ok: false,
      reason: 'passphrase-too-short',
    });

    await repo.create({ title: 'x', done: false });
    await connect(params, deps); // plain data now on the server
    const other = device();
    expect(
      await connect({ ...params, encrypt: true, passphrase: 'a long passphrase' }, other.deps),
    ).toEqual({
      ok: false,
      reason: 'server-has-plain-data',
    });
    // After an explicit reset the encrypted setup works; this device's data is the new source.
    expect(await resetServer(params, other.deps)).toBeUndefined();
    expect(
      await connect({ ...params, encrypt: true, passphrase: 'a long passphrase' }, other.deps),
    ).toEqual({ ok: true, encrypted: true });
  });

  it('resetServer reports errors', async () => {
    expect(await resetServer({ url: 'nope', token: 'x' }, deps)).toEqual({
      ok: false,
      reason: 'invalid-url',
    });
    expect(await resetServer({ url: 'https://s.example', token: 'wrong' }, deps)).toEqual({
      ok: false,
      reason: 'unauthorized',
    });
  });
});

describe('syncNow and status', () => {
  it('does nothing while not configured', async () => {
    await syncNow(deps);
    expect(useSyncStatus.getState().phase).toBe('off');
    expect(server.requests).toEqual({ push: 0, pull: 0 });
  });

  it('reports errors in the status and recovers on the next run', async () => {
    await connect(params, deps);
    await repo.create({ title: 'später', done: false });
    server.online = false;
    await syncNow(deps);
    expect(useSyncStatus.getState()).toMatchObject({
      phase: 'error',
      error: 'network',
      pending: 1,
    });
    server.online = true;
    await syncNow(deps);
    expect(useSyncStatus.getState()).toMatchObject({ phase: 'idle', error: undefined, pending: 0 });
  });

  it('a token that was revoked shows up as "unauthorized"', async () => {
    await connect(params, deps);
    server.token = 'rotated-token';
    await syncNow(deps);
    expect(useSyncStatus.getState()).toMatchObject({ phase: 'error', error: 'unauthorized' });
  });

  it('runs syncs one after another, never in parallel', async () => {
    await connect(params, deps);
    let running = 0;
    let maxRunning = 0;
    const base = server.remote();
    deps.remote = () => ({
      ...base,
      async pull(since, limit) {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 5));
        running--;
        return base.pull(since, limit);
      },
    });
    await Promise.all([syncNow(deps), syncNow(deps), syncNow(deps)]);
    expect(maxRunning).toBe(1);
  });

  it('restores the status after a reload from the stored configuration', async () => {
    await connect(params, deps);
    useSyncStatus.getState().set({ phase: 'off', server: undefined, lastSyncAt: undefined });
    await restoreSyncStatus(deps);
    expect(useSyncStatus.getState()).toMatchObject({ phase: 'idle', server: 'sync.example' });
    expect(useSyncStatus.getState().lastSyncAt).toBeTypeOf('number');
  });
});

describe('disconnect', () => {
  it('removes the configuration and keeps local data; reconnecting uploads everything again', async () => {
    await repo.create({ title: 'bleibt', done: false });
    await connect(params, deps);
    await disconnect(deps);
    expect(await loadSyncConfig(db)).toBeUndefined();
    expect(useSyncStatus.getState().phase).toBe('off');
    expect((await repo.active().toArray()).map((e) => e.title)).toEqual(['bleibt']);

    server.reset();
    const spy = vi.spyOn(server, 'reset');
    await connect(params, deps);
    expect(server.dump().some((o) => o.value === 'bleibt')).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
