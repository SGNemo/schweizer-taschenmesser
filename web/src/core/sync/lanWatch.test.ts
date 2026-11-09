// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createFakeLanHubParts } from '@/core/platform/fakeLanHub';
import type { LanClientService, LanWatchService } from '@/core/platform/types';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { createTestDb } from '@/test-utils';
import { connect, pairWithPc, startSync, type SyncServiceDeps } from './service';
import { useSyncStatus } from './status';
import { MemoryServer } from './testing';

/** Wi-Fi of the `lan-watch` plugin, switched by the test. */
function fakeWatch(initial: boolean) {
  const listeners = new Set<(c: boolean) => void>();
  const watch: LanWatchService = {
    supported: true,
    wifi: async () => initial,
    onWifiChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
  return { watch, set: (c: boolean) => listeners.forEach((l) => l(c)), listeners };
}

let db: TaschenmesserDB;
let requests: number;
let deps: SyncServiceDeps;

beforeEach(() => {
  db = createTestDb();
  requests = 0;
  const { hub } = createFakeLanHubParts();
  const client: LanClientService = {
    supported: true,
    pair: async (_qr, _name, onCode) => {
      onCode('482913');
      return { ...(await hub.start()).dataKey, hub: 'ab'.repeat(32) };
    },
    cancelPair: async () => undefined,
    request: async (body) => {
      requests++;
      return hub.request(body);
    },
    unpair: async () => undefined,
  };
  const server = new MemoryServer();
  deps = {
    database: db,
    storage: new DexieStorageAdapter(db),
    remote: (_url, token) => server.remote(token),
    kdf: { m: 8, t: 1, p: 1 },
    lanClient: () => client,
  };
  useSyncStatus.getState().set({
    phase: 'off',
    via: undefined,
    error: undefined,
    retryAt: undefined,
    failures: 0,
    wifi: undefined,
  });
});
afterEach(async () => {
  db.close();
  await db.delete();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 200));

describe('Wi-Fi watch (phone comes home)', () => {
  it('a phone paired with a PC syncs at once when Wi-Fi comes up, and keeps the Wi-Fi state', async () => {
    const wifi = fakeWatch(false);
    deps.lanWatch = () => wifi.watch;
    expect(await pairWithPc('NEMO1:qr', 'Handy', () => undefined, deps)).toEqual({ ok: true });
    const stop = startSync(deps);
    try {
      await vi.waitFor(() => expect(useSyncStatus.getState().wifi).toBe(false));
      await vi.waitFor(() => expect(useSyncStatus.getState().phase).toBe('idle'));
      await settle();
      const before = requests;
      wifi.set(true);
      expect(useSyncStatus.getState().wifi).toBe(true);
      await vi.waitFor(() => expect(requests).toBeGreaterThan(before));
      wifi.set(false);
      expect(useSyncStatus.getState().wifi).toBe(false);
    } finally {
      stop();
    }
    expect(wifi.listeners.size).toBe(0);
  });

  it('Wi-Fi alone starts no round for a device on an own server', async () => {
    const wifi = fakeWatch(true);
    deps.lanWatch = () => wifi.watch;
    let pulls = 0;
    const server = new MemoryServer();
    deps.remote = (_url, token) => {
      const r = server.remote(token);
      return { ...r, pull: (since, limit) => (pulls++, r.pull(since, limit)) };
    };
    expect(
      (await connect({ url: 'https://sync.example', token: 'right-token', encrypt: false }, deps))
        .ok,
    ).toBe(true);
    const stop = startSync(deps);
    try {
      await vi.waitFor(() => expect(useSyncStatus.getState().phase).toBe('idle'));
      await settle();
      const before = pulls;
      wifi.set(true);
      await settle();
      expect(pulls).toBe(before);
    } finally {
      stop();
    }
  });

  it('nothing is watched where the platform does not support it', async () => {
    const onWifiChange = vi.fn(() => () => undefined);
    deps.lanWatch = () => ({ supported: false, wifi: async () => undefined, onWifiChange });
    const stop = startSync(deps);
    stop();
    expect(onWifiChange).not.toHaveBeenCalled();
    expect(useSyncStatus.getState().wifi).toBeUndefined();
  });
});
