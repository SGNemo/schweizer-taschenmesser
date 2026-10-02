// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRepo, type Repo } from '@/core/db/repo';
import { allManifests } from '@/core/modules/registry';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { createTestDb } from '@/test-utils';
import type { TaschenmesserDB } from '@/core/db/db';
import { connect, startSync, type SyncServiceDeps } from './service';
import { useSyncStatus } from './status';
import { MemoryServer } from './testing';

const schema = allManifests.find((m) => m.id === 'example')!.dataSchema.collections.entry!.schema;
type Entry = { title: string; done: boolean };

const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };

let server: MemoryServer;
let db: TaschenmesserDB;
let repo: Repo<Entry>;
let pulls: number;
let deps: SyncServiceDeps;

beforeEach(() => {
  server = new MemoryServer();
  db = createTestDb();
  repo = createRepo('example_entry', schema, db) as unknown as Repo<Entry>;
  pulls = 0;
  deps = {
    database: db,
    storage: new DexieStorageAdapter(db),
    remote: (_url, token) => {
      const r = server.remote(token);
      return {
        ...r,
        pull: (since, limit) => {
          pulls++;
          return r.pull(since, limit);
        },
      };
    },
    kdf: { m: 8, t: 1, p: 1 },
  };
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
  db.close();
  await db.delete();
});

describe('startSync', () => {
  it('does not run a redundant sync after the debounce once the outbox is already empty', async () => {
    // The first sync after connecting queues every record (pending > 0, debounce armed) and the
    // same sync pushes them. The armed timer must not fire another round afterwards: that late
    // round could land right after another device reset the server and re-upload plaintext.
    await repo.create({ title: 'Brot', done: false });
    const stop = startSync(deps);
    try {
      expect((await connect(params, deps)).ok).toBe(true);
      await vi.waitFor(async () => expect(await deps.storage.pendingCount()).toBe(0));
      const afterConnect = pulls;
      await new Promise((resolve) => setTimeout(resolve, 1800)); // longer than the 1.5 s debounce
      expect(pulls).toBe(afterConnect);
    } finally {
      stop();
    }
  });

  it('still syncs shortly after a local change', async () => {
    expect((await connect(params, deps)).ok).toBe(true);
    const stop = startSync(deps);
    try {
      await repo.create({ title: 'Milch', done: false });
      await vi.waitFor(async () => expect(await deps.storage.pendingCount()).toBe(0), {
        timeout: 5000,
      });
    } finally {
      stop();
    }
  });
});
