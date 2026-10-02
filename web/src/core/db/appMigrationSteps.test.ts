import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseBackup } from '@/core/backup/backup';
import { restoreBackup } from '@/core/backup/restore';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import { runSync } from '@/core/sync/engine';
import { connect, syncNow, type SyncServiceDeps } from '@/core/sync/service';
import { MemoryServer } from '@/core/sync/testing';
import { setNow } from '@/core/time/now';
import { itemSchema as listsItemSchema } from '@/modules/lists/schema';
import { itemSchema as shoppingSchema } from '@/modules/shopping/schema';
import { createTestDb } from '@/test-utils';
import { runAppMigrations } from './appMigrations';
import { APP_MIGRATIONS } from './appMigrationSteps';

/**
 * Package 3 against a backup in the 0.3.1 format (invented data): importing it, the old
 * tables are copied forward into `lists_*` and `bookmarks_item`.
 */
const FIXTURE = resolve(process.cwd(), 'src/core/backup/fixtures/backup-0.3.1-lists.json');
const load = () => {
  const parsed = parseBackup(readFileSync(FIXTURE, 'utf8'));
  if (!parsed.ok) throw new Error('fixture does not parse');
  return parsed.backup;
};

const dbs: TaschenmesserDB[] = [];
let clock = 1_800_000_000_000;
let server: MemoryServer;
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
const fresh = () => {
  const d = createTestDb();
  dbs.push(d);
  return d;
};
const live = async (db: TaschenmesserDB, table: string) =>
  (await db.table(table).toArray()).filter((r) => r.deletedAt === null);
const restore = (db: TaschenmesserDB, mode: 'merge' | 'replace') =>
  restoreBackup(load(), mode, { database: db, safety: async () => 'safety' });

describe('0.3.1 backup → lists and bookmarks', () => {
  it('has one step per old table, ids are unique and stable', () => {
    expect(APP_MIGRATIONS.map((s) => s.id)).toEqual([
      '0.5.0-shopping-item',
      '0.5.0-packing-list',
      '0.5.0-packing-item',
      '0.5.0-launcher-link',
      '0.6.0-contract',
      '0.6.0-birthday',
      '0.6.0-gift',
      '0.7.0-reminder',
    ]);
  });

  it('copies shopping entries (same ids) onto the default list, keeps tombstones', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const items = await db.table('lists_item').toArray();
    const shop = items
      .filter((i) => i.listId === 'shopping-default')
      .sort((a, b) => a.order - b.order);
    expect(shop.map((i) => [i.id, i.name, i.quantity, i.done, i.deletedAt === null])).toEqual([
      ['fx-shop-1', 'Milch', '2', false, true],
      ['fx-shop-2', 'Brot', undefined, true, true],
      ['fx-shop-3', 'Mehl', '500 g', false, false], // deleted on the old device
    ]);
    expect(shop.map((i) => i.order)).toEqual([1790000001000, 1790000002000, 1790000003000]);
    expect(await db.table('lists_list').get('shopping-default')).toMatchObject({
      name: 'Einkauf',
      kind: 'shopping',
      order: 0,
      deletedAt: null,
    });
  });

  it('copies packing lists and items (packed → done) with their list references', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const lists = (await live(db, 'lists_list')).filter((l) => l.kind === 'packing');
    expect(lists.map((l) => [l.id, l.name, l.note]).sort()).toEqual([
      ['fx-pack-1', 'Wochenendtrip', 'Zwei Nächte'],
      ['fx-pack-2', 'Strandurlaub', undefined],
    ]);
    const items = (await live(db, 'lists_item')).filter((i) => i.listId.startsWith('fx-pack'));
    expect(items.map((i) => [i.id, i.listId, i.name, i.done, i.order]).sort()).toEqual([
      ['fx-pitem-1', 'fx-pack-1', 'Zahnbürste', true, 0],
      ['fx-pitem-2', 'fx-pack-1', 'Ladekabel', false, 1],
      ['fx-pitem-3', 'fx-pack-2', 'Badesachen', false, 0],
    ]);
    // 1:1 fields keep the stamp of the source field, "packed" → "done" included.
    const source = (await db.table('packing_item').get('fx-pitem-1'))!;
    const copy = (await db.table('lists_item').get('fx-pitem-1'))!;
    expect(copy._f.done).toBe(source._f.packed);
    expect(copy._f.name).toBe(source._f.name);
  });

  it('turns launcher links into bookmarks of the kind "link", the group becomes a tag', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const bookmarks = await live(db, 'bookmarks_item');
    const links = bookmarks.filter((b) => b.id.startsWith('fx-link'));
    expect(links.map((b) => [b.id, b.title, b.kind, b.tags, b.done]).sort()).toEqual([
      ['fx-link-1', 'DHL', 'link', ['Pakete'], false],
      ['fx-link-2', 'Wetter', 'link', [], false],
      ['fx-link-3', 'Bahn', 'link', ['Reisen'], false],
      ['fx-link-4', 'Karte', 'link', ['Reisen'], false],
    ]);
    // Existing bookmarks are untouched.
    expect(bookmarks.find((b) => b.id === 'fx-bm-1')).toMatchObject({
      kind: 'read',
      title: 'Rezept Linsensuppe',
    });
  });

  it('is idempotent, never touches the old tables and queues the copies for sync', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const before = {
      lists: await db.table('lists_item').toArray(),
      bookmarks: await db.table('bookmarks_item').toArray(),
      outbox: await db.table('_outbox').toArray(),
    };
    const reports = await runAppMigrations(db);
    expect(reports.map((r) => r.copied)).toEqual(APP_MIGRATIONS.map(() => 0));
    expect(await db.table('lists_item').toArray()).toEqual(before.lists);
    expect(await db.table('bookmarks_item').toArray()).toEqual(before.bookmarks);
    expect(await db.table('_outbox').toArray()).toEqual(before.outbox);
    expect(await db.table('shopping_item').count()).toBe(3);
    expect(await db.table('packing_item').count()).toBe(3);
    expect(await db.table('launcher_link').count()).toBe(4);
    expect((await db.table('_outbox').toArray()).map((o) => o.collection)).toEqual(
      expect.arrayContaining(['lists_item', 'lists_list', 'bookmarks_item']),
    );
  });

  it('also works when the backup replaces the data of a device that already migrated', async () => {
    const db = fresh();
    await restore(db, 'merge');
    await restore(db, 'replace');
    const items = await live(db, 'lists_item');
    expect(items.map((i) => i.id).sort()).toEqual(
      ['fx-pitem-1', 'fx-pitem-2', 'fx-pitem-3', 'fx-shop-1', 'fx-shop-2'].sort(),
    );
    expect((await live(db, 'bookmarks_item')).length).toBe(5);
  });

  it('edits made after the migration are never overwritten by the old rows', async () => {
    const db = fresh();
    await restore(db, 'merge');
    const items = createRepo(tableName('lists', 'item'), listsItemSchema, db);
    await items.update('fx-shop-1', { name: 'Hafermilch' });
    await restore(db, 'merge');
    await runAppMigrations(db);
    expect((await items.get('fx-shop-1'))?.name).toBe('Hafermilch');
  });
});

describe('an older device keeps writing the old tables', () => {
  const params = { url: 'https://sync.example', token: 'right-token', encrypt: false };

  it('a pull on the new device brings the entry into the new table, edits follow', async () => {
    const oldDb = fresh();
    const newDb = fresh();
    const oldDeps: SyncServiceDeps = {
      database: oldDb,
      storage: new DexieStorageAdapter(oldDb),
      remote: (_u, t) => server.remote(t),
      kdf: { m: 8, t: 1, p: 1 },
    };
    const newDeps: SyncServiceDeps = {
      ...oldDeps,
      database: newDb,
      storage: new DexieStorageAdapter(newDb),
    };
    const shopping = createRepo(tableName('shopping', 'item'), shoppingSchema, oldDb);
    const a = await shopping.create({ name: 'Milch', quantity: '2', done: false });
    await runSync({ storage: oldDeps.storage, adapter: server.adapter() });

    await connect(params, newDeps);
    await syncNow(newDeps);
    expect(await newDb.table('lists_item').get(a.id)).toMatchObject({
      listId: 'shopping-default',
      name: 'Milch',
      quantity: '2',
      done: false,
    });

    await shopping.update(a.id, { done: true });
    await runSync({ storage: oldDeps.storage, adapter: server.adapter() });
    await syncNow(newDeps);
    expect((await newDb.table('lists_item').get(a.id))?.done).toBe(true);
  });
});
