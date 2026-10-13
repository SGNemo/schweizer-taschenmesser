import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestDb } from '@/test-utils';
import { TaschenmesserDB } from './db';
import { checkDb, dumpDb, repairDb, replaceWithEmptyDb } from './health';

const opened: TaschenmesserDB[] = [];
const mk = (name?: string) => {
  const d = name ? new TaschenmesserDB(name) : createTestDb();
  opened.push(d);
  return d;
};
afterEach(async () => {
  for (const d of opened.splice(0)) {
    d.close();
    await d.delete();
  }
});

/** A database written by a "newer app": plain IndexedDB with a version far above the app's. */
async function newerDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open(name, 99999);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore('todos_task', { keyPath: 'id' });
      store.put({ id: 'a', title: 'Brot kaufen' });
      req.result
        .createObjectStore('_secrets', { keyPath: 'key' })
        .put({ key: 'k', value: 'geheim' });
    };
    req.onsuccess = () => {
      req.result.close();
      resolve();
    };
    req.onerror = () => reject(req.error);
  });
}

describe('database health', () => {
  it('reports a healthy database as healthy', async () => {
    expect(await checkDb(mk())).toBeUndefined();
  });

  it('detects a database from a newer version and never touches it in repair', async () => {
    const name = `newer-${Date.now()}`;
    await newerDatabase(name);
    const d = mk(name);
    d.close();
    vi.spyOn(d, 'open').mockRejectedValue(new Dexie.VersionError('stored version is newer'));
    const problem = await checkDb(d);
    expect(problem?.name).toBe('VersionError');
    expect((await repairDb(d))?.name).toBe('VersionError');
    // still there afterwards
    const dump = await dumpDb(name);
    expect(dump.rows).toBe(1);
  });

  it('dump keeps readable rows but never device secrets', async () => {
    const name = `dump-${Date.now()}`;
    await newerDatabase(name);
    const { text } = await dumpDb(name);
    expect(text).toContain('Brot kaufen');
    expect(text).not.toContain('geheim');
    expect(JSON.parse(text).format).toBe('nemo-broken-db-copy');
    mk(name); // deleted in afterEach
  });

  it('replaces a broken database with an empty one that works', async () => {
    const name = `reset-${Date.now()}`;
    await newerDatabase(name);
    const d = mk(name);
    const open = vi
      .spyOn(d, 'open')
      .mockRejectedValueOnce(new Dexie.UpgradeError('cannot upgrade'));
    d.close();
    expect((await checkDb(d))?.name).toBe('UpgradeError');
    open.mockRestore();
    await replaceWithEmptyDb(d);
    expect(await checkDb(d)).toBeUndefined();
    expect(await d.table('todos_task').count()).toBe(0);
  });

  it('empties an unreadable table and reports healthy afterwards', async () => {
    const d = mk();
    await d.open();
    const real = d.table('todos_task');
    const spy = vi.spyOn(real, 'limit').mockImplementationOnce(() => {
      throw new Error('corrupt table');
    });
    const problem = await checkDb(d);
    expect(problem?.tables).toEqual(['todos_task']);
    spy.mockImplementationOnce(() => {
      throw new Error('corrupt table');
    });
    expect(await repairDb(d)).toBeUndefined();
  });
});
