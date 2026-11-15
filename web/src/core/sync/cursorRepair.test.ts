import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { createFakeLanHubParts } from '@/core/platform/fakeLanHub';
import { DexieStorageAdapter, TABLES_KEY } from '@/core/storage/dexie';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { runSync } from './engine';
import { enableLanHub, syncNow, type SyncServiceDeps } from './service';
import { MemoryServer } from './testing';

/**
 * Cursor repair: an app version that does not know a table drops its pulled ops while the cursor moves
 * on. After the update (the table is known) the pull restarts at 0 once and the rows arrive.
 */
const example = allManifests.find((m) => m.id === 'example')!;
const todos = allManifests.find((m) => m.id === 'todos')!;
const entrySchema = example.dataSchema.collections.entry!.schema;
const taskSchema = todos.dataSchema.collections.task!.schema;
type Entry = { title: string; done: boolean };

const OLD = ['example_entry'];
const NEW = ['example_entry', 'todos_task'];

let clock = 1_800_000_000_000;
let server: MemoryServer;
const dbs: TaschenmesserDB[] = [];

function database(): TaschenmesserDB {
  const db = createTestDb();
  dbs.push(db);
  return db;
}
const entries = (db: TaschenmesserDB) =>
  createRepo('example_entry', entrySchema, db) as unknown as Repo<Entry>;
const tasks = (db: TaschenmesserDB) =>
  createRepo('todos_task', taskSchema, db) as unknown as Repo<Record<string, unknown>>;
const sync = (db: TaschenmesserDB, tables: string[]) =>
  runSync({ storage: new DexieStorageAdapter(db, tables), adapter: server.adapter() });
const meta = async (db: TaschenmesserDB, key: string) =>
  (await db.table('_meta').get(key))?.value as unknown;

beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
  server = new MemoryServer();
});
afterEach(async () => {
  setNow();
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

/** A (new app) wrote an entry and a task; B (old app, knows no `todos_task`) pulled both. */
async function oldDevicePulled(): Promise<{ b: TaschenmesserDB; taskId: string }> {
  const a = database();
  const b = database();
  await entries(a).create({ title: 'Milch', done: false });
  const task = await tasks(a).create({ title: 'Steuer', listId: 'inbox' });
  await sync(a, NEW);
  await sync(b, OLD);
  expect(await b.table('example_entry').count()).toBe(1);
  expect(await b.table('todos_task').count()).toBe(0); // dropped, and the cursor moved on
  expect(await new DexieStorageAdapter(b, OLD).getCursor()).toBeGreaterThan(0);
  return { b, taskId: task.id };
}

describe('cursor repair for newly synced tables', () => {
  it('a device that pulled ops for a then-unknown table holds those rows after the update', async () => {
    const { b, taskId } = await oldDevicePulled();
    // Without the repair nothing would come: every op is behind the cursor.
    const result = await sync(b, NEW);
    expect(result.restarted).toBe(true);
    expect(await b.table('todos_task').get(taskId)).toMatchObject({ title: 'Steuer' });
    expect(await meta(b, TABLES_KEY)).toEqual(NEW);
    // The replay is no upload and no conflict: nothing queued, nothing logged.
    expect(await b.table('_outbox').count()).toBe(0);
    expect(await b.table('_conflicts').count()).toBe(0);
  });

  it('restarts exactly once when a table was added, and never when nothing changed', async () => {
    const { b } = await oldDevicePulled();
    expect((await sync(b, OLD)).restarted).toBeUndefined();
    expect((await sync(b, NEW)).restarted).toBe(true);
    const cursor = await new DexieStorageAdapter(b, NEW).getCursor();
    for (let i = 0; i < 3; i++) {
      const again = await sync(b, NEW);
      expect(again.restarted).toBeUndefined();
      expect(again.pulled).toBe(0);
    }
    expect(await new DexieStorageAdapter(b, NEW).getCursor()).toBe(cursor);
  });

  it('a fresh install does not restart (no loop): the first round stores the set', async () => {
    const a = database();
    await entries(a).create({ title: 'Brot', done: false });
    await sync(a, NEW);
    const fresh = database();
    const first = await sync(fresh, NEW);
    expect(first.restarted).toBeUndefined();
    expect(await meta(fresh, TABLES_KEY)).toEqual(NEW);
    const before = server.requests.pull;
    expect((await sync(fresh, NEW)).restarted).toBeUndefined();
    expect(server.requests.pull).toBe(before + 1); // one page, not a second walk from 0
  });

  it('an install from before the repair (cursor moved, no stored set) restarts once', async () => {
    const { b, taskId } = await oldDevicePulled();
    await b.table('_meta').delete(TABLES_KEY); // as an app version without the repair left it
    expect((await sync(b, NEW)).restarted).toBe(true);
    expect(await b.table('todos_task').get(taskId)).toBeTruthy();
    expect((await sync(b, NEW)).restarted).toBeUndefined();
  });

  it('a shrinking set does not restart; a table that returns later does', async () => {
    const a = database();
    await entries(a).create({ title: 'Eins', done: false });
    await sync(a, NEW);
    const b = database();
    await sync(b, NEW);
    const task = await tasks(a).create({ title: 'Später', listId: 'inbox' });
    await sync(a, NEW);
    const shrunk = await sync(b, OLD); // the table left this app version: its op is dropped
    expect(shrunk.restarted).toBeUndefined();
    expect(await meta(b, TABLES_KEY)).toEqual(OLD);
    expect(await b.table('todos_task').get(task.id)).toBeUndefined();
    expect((await sync(b, NEW)).restarted).toBe(true);
    expect(await b.table('todos_task').get(task.id)).toMatchObject({ title: 'Später' });
  });

  it('a replay never logs a conflict for a record with unsynced local edits, and the edit wins', async () => {
    const a = database();
    const row = await entries(a).create({ title: 'alt', done: false });
    await sync(a, NEW);
    const b = database();
    await sync(b, OLD);
    await entries(b).update(row.id, { title: 'neu auf B' }); // unsynced when the update arrives
    const result = await sync(b, NEW);
    expect(result.restarted).toBe(true);
    expect(await b.table('_conflicts').count()).toBe(0);
    expect((await entries(b).get(row.id))?.title).toBe('neu auf B');
    await sync(a, NEW);
    expect((await entries(a).get(row.id))?.title).toBe('neu auf B');
  });

  it('the page that crosses the replay mark is a replay too: one unrelated new op causes no false conflict', async () => {
    const a = database();
    const row = await entries(a).create({ title: 'alt', done: false });
    await sync(a, NEW);
    const b = database();
    await sync(b, OLD);
    await entries(b).update(row.id, { title: 'neu auf B' }); // unsynced
    await entries(a).create({ title: 'neu auf A, hat damit nichts zu tun', done: false });
    await sync(a, NEW); // one new op set beyond B's old cursor: the restarted pull is one page across the mark
    const result = await sync(b, NEW);
    expect(result.restarted).toBe(true);
    expect(await b.table('_conflicts').count()).toBe(0);
    expect((await entries(b).get(row.id))?.title).toBe('neu auf B');
    expect(await b.table('example_entry').count()).toBe(2);
    // Past the mark conflicts are noted again.
    await sync(a, NEW);
    await entries(a).update(row.id, { title: 'A ändert' });
    await entries(b).update(row.id, { title: 'B ändert später' });
    await sync(a, NEW);
    await sync(b, NEW);
    expect(await b.table('_conflicts').count()).toBe(1);
  });

  it('a changed remote data set forgets the replay mark', async () => {
    const { b } = await oldDevicePulled();
    await sync(b, NEW);
    const storage = new DexieStorageAdapter(b, NEW);
    expect(await storage.getReplayUntil()).toBeGreaterThan(0);
    server.reset();
    await sync(b, NEW);
    expect(await storage.getReplayUntil()).toBe(0);
  });

  it('the real table set is stored as it is (sorted), so the next app version compares against it', async () => {
    const db = database();
    await runSync({ storage: new DexieStorageAdapter(db), adapter: server.adapter() });
    expect(await meta(db, TABLES_KEY)).toEqual([...syncedTableNames(allManifests)].sort());
  });
});

describe('cursor repair through the home-network hub (same store, same cursor)', () => {
  it('a PC that pulled through the hub with an older table set gets the rows after its update', async () => {
    const fake = createFakeLanHubParts();
    const pc = (tables: string[], db = database()) => {
      const deps: SyncServiceDeps = {
        database: db,
        storage: new DexieStorageAdapter(db, tables),
        remote: () => new MemoryServer().remote('t'),
        lanHub: () => fake.hub,
      };
      return { db, deps };
    };
    const a = pc(NEW);
    const task = await tasks(a.db).create({ title: 'Über den Hub', listId: 'inbox' });
    await entries(a.db).create({ title: 'Eintrag', done: false });
    await enableLanHub(a.deps);

    const old = pc(OLD);
    await enableLanHub(old.deps);
    expect(await old.db.table('example_entry').count()).toBe(1);
    expect(await old.db.table('todos_task').count()).toBe(0);

    const updated = pc(NEW, old.db);
    await syncNow(updated.deps);
    expect(await old.db.table('todos_task').get(task.id)).toMatchObject({ title: 'Über den Hub' });
  });
});
