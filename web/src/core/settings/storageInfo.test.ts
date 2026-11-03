// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { LAZY_CACHE } from '@/pwa/lazyCache';
import {
  attachmentStats,
  cacheEntries,
  clearRuntimeCache,
  formatBytes,
  moduleEntryCounts,
  readUsage,
} from './storageInfo';

const manifests = [
  { id: 'todos', name: 'Aufgaben', dataSchema: { collections: { task: {}, list: {} } } },
  { id: 'notes', name: 'Notizen', dataSchema: { collections: { note: {} } } },
  { id: 'accounts', name: 'Passwörter', dataSchema: { collections: { entry: {} } } },
] as never[];

beforeEach(async () => {
  await Promise.all(
    ['todos_task', 'todos_list', 'notes_note', 'accounts_entry', '_blobs'].map((t) =>
      db.table(t).clear(),
    ),
  );
});

describe('storage info', () => {
  it('counts entries per active module, without deleted ones, most first, and never the vault', async () => {
    await db.table('todos_task').bulkPut([{ id: 'a' }, { id: 'b' }, { id: 'c', deletedAt: 5 }]);
    await db.table('todos_list').put({ id: 'l' });
    await db.table('notes_note').bulkPut([{ id: 'n1' }]);
    await db.table('accounts_entry').bulkPut([{ id: 'x' }, { id: 'y' }]);
    const counts = await moduleEntryCounts(manifests, new Set(['todos', 'notes', 'accounts']));
    expect(counts).toEqual([
      { id: 'todos', name: 'Aufgaben', entries: 3 },
      { id: 'notes', name: 'Notizen', entries: 1 },
    ]);
    expect(await moduleEntryCounts(manifests, new Set(['notes']))).toHaveLength(1);
  });

  it('adds up the attachments', async () => {
    await db.table('_blobs').bulkPut([
      { key: 'a', type: 'x', data: new ArrayBuffer(100) },
      { key: 'b', type: 'x', data: new ArrayBuffer(28) },
    ]);
    expect(await attachmentStats()).toEqual({ files: 2, bytes: 128 });
  });

  it('reads usage and persistence where the browser tells, and nothing where it does not', async () => {
    expect(
      await readUsage({
        estimate: async () => ({ usage: 10, quota: 100 }),
        persisted: async () => true,
      }),
    ).toEqual({ used: 10, quota: 100, persisted: true });
    expect(await readUsage(undefined)).toEqual({});
  });

  it('counts and clears only the runtime cache', async () => {
    const files = new Map<string, string[]>([
      [LAZY_CACHE, ['a', 'b', 'c']],
      ['workbox-precache-v2', ['x']],
    ]);
    const storage = {
      has: async (n: string) => files.has(n),
      open: async (n: string) => ({ keys: async () => files.get(n) ?? [] }),
      delete: async (n: string) => files.delete(n),
    } as never;
    expect(await cacheEntries(storage)).toBe(3);
    expect(await clearRuntimeCache(storage)).toBe(3);
    expect(files.has(LAZY_CACHE)).toBe(false);
    expect(files.has('workbox-precache-v2')).toBe(true); // the app itself stays offline-capable
    expect(await clearRuntimeCache(storage)).toBe(0);
    expect(await cacheEntries(undefined)).toBeUndefined();
  });

  it('writes sizes in short form', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toMatch(/^1[.,]5 KB$/);
    expect(formatBytes(5 * 1024 * 1024)).toMatch(/^5 MB$/);
  });
});
