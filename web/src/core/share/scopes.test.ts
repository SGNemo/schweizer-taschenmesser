import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createRepo, type Repo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { createTestDb } from '@/test-utils';
import { applyListChoice, LIST_SCOPES, listChoices, listScopeOf } from './scopes';
import { applyShare, createPairFile, readShareFile } from './share';

const KDF = { m: 8, t: 1, p: 1 };
const CODE = 'apfel birne kirsche dattel feige gurke'; // invented
const dbs: TaschenmesserDB[] = [];
const newDb = () => {
  const db = createTestDb();
  dbs.push(db);
  return db;
};
const repoOf = (table: string, db: TaschenmesserDB) => {
  const [moduleId, collection] = table.split('_') as [string, string];
  const manifest = allManifests.find((m) => m.id === moduleId)!;
  return createRepo(
    table,
    manifest.dataSchema.collections[collection]!.schema,
    db,
  ) as unknown as Repo<Record<string, unknown>>;
};

let clock = 1_800_000_000_000;
beforeEach(() => {
  clock = 1_800_000_000_000;
  setNow(() => (clock += 10));
});
afterEach(async () => {
  setNow(undefined);
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

describe('list scopes', () => {
  it('only name tables and fields that exist in the modules', () => {
    for (const scope of LIST_SCOPES) {
      const manifest = allManifests.find((m) => m.id === scope.moduleId)!;
      const collections = Object.keys(manifest.dataSchema.collections).map((c) =>
        tableName(scope.moduleId, c),
      );
      expect(collections, scope.moduleId).toContain(scope.parent.table);
      const parentCollection = scope.parent.table.slice(scope.moduleId.length + 1);
      const parentShape = (
        manifest.dataSchema.collections[parentCollection]!.schema as unknown as {
          shape: Record<string, unknown>;
        }
      ).shape;
      expect(Object.keys(parentShape), scope.moduleId).toContain(scope.parent.nameField);
      for (const child of scope.children) {
        expect(collections, scope.moduleId).toContain(child.table);
        const collection = child.table.slice(scope.moduleId.length + 1);
        const shape = (
          manifest.dataSchema.collections[collection]!.schema as unknown as {
            shape: Record<string, unknown>;
          }
        ).shape;
        expect(Object.keys(shape), child.table).toContain(child.fk);
      }
    }
    expect(listScopeOf('notes')).toBeUndefined();
  });

  it('share only the chosen list with its entries, deletions included', async () => {
    const mine = newDb();
    const theirs = newDb();
    const lists = repoOf('lists_list', mine);
    const items = repoOf('lists_item', mine);
    const trip = await lists.create({ name: 'Urlaub', kind: 'packing', order: 1 });
    const food = await lists.create({ name: 'Einkauf', kind: 'shopping', order: 2 });
    const sock = await items.create({
      listId: trip.id as string,
      name: 'Socken',
      done: false,
      order: 0,
    });
    await items.create({ listId: food.id as string, name: 'Milch', done: false, order: 0 });
    await items.remove(sock.id as string);
    await items.create({ listId: trip.id as string, name: 'Hut', done: false, order: 1 });

    expect((await listChoices('lists', mine)).map((c) => c.name)).toEqual(['Einkauf', 'Urlaub']);

    const file = await createPairFile({
      modules: ['lists'],
      code: CODE,
      database: mine,
      kdf: KDF,
      lists: { lists: [trip.id as string] },
    });
    const read = await readShareFile(file.text, CODE);
    if (!read.ok) throw new Error('read failed');
    const tables = read.backup.tables;
    expect(tables['lists_list']!.map((r) => r.id)).toEqual([trip.id]);
    expect(tables['lists_item']!.map((r) => r.name).sort()).toEqual(['Hut', 'Socken']); // Socken: deleted, still travels
    expect(JSON.stringify(read.backup)).not.toContain('Milch');

    await applyShare(read.backup, theirs);
    expect((await listChoices('lists', theirs)).map((c) => c.name)).toEqual(['Urlaub']);
    const received = await repoOf('lists_item', theirs).active().toArray();
    expect(received.map((r) => r.name)).toEqual(['Hut']);
  });

  it('leaves modules without a choice and empty choices whole', () => {
    const tables = {
      lists_list: [{ id: 'a' }, { id: 'b' }],
      lists_item: [{ id: 'i', listId: 'a' }],
      notes_note: [{ id: 'n' }],
    } as never;
    expect(applyListChoice(tables, undefined)).toBe(tables);
    expect(Object.keys(applyListChoice(tables, { lists: [] }))).toEqual(Object.keys(tables));
    const picked = applyListChoice(tables, { lists: ['a'] }) as Record<string, unknown[]>;
    expect(picked['lists_list']).toHaveLength(1);
    expect(picked['notes_note']).toHaveLength(1);
  });
});
