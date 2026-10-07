import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import {
  copyName,
  isDuplicate,
  nextOrder,
  parseEntry,
  progress,
  sortItems,
  sortLists,
} from '../logic';
import manifest from '../manifest';
import {
  addItem,
  clearDone,
  deleteList,
  duplicateList,
  ensureShoppingList,
  itemRepo,
  itemsOf,
  listRepo,
  resetList,
} from '../repo';
import { SHOPPING_LIST_ID, itemSchema, listSchema } from '../schema';
import { addRequested } from '../services';

beforeEach(async () => {
  await db.table('lists_list').clear();
  await db.table('lists_item').clear();
});

describe('lists module', () => {
  it('has a valid manifest, is off by default and sits next to the pantry', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.area).toBe('household');
  });

  it('validates lists and entries', () => {
    expect(listSchema.parse({ name: 'x' })).toMatchObject({ kind: 'checklist', order: 0 });
    expect(listSchema.safeParse({ name: 'x', kind: 'other' }).success).toBe(false);
    expect(itemSchema.safeParse({ listId: '', name: 'x' }).success).toBe(false);
    expect(itemSchema.parse({ listId: 'a', name: 'x' })).toMatchObject({ done: false, order: 0 });
  });

  it.each([
    ['Milch', { name: 'Milch' }],
    ['2 Milch', { name: 'Milch', quantity: '2' }],
    ['2x Milch', { name: 'Milch', quantity: '2' }],
    ['500 g Mehl', { name: 'Mehl', quantity: '500 g' }],
    ['1,5 l Wasser', { name: 'Wasser', quantity: '1,5 l' }],
    ['  3   Äpfel ', { name: 'Äpfel', quantity: '3' }],
    ['7up', { name: '7up' }],
    ['24', { name: '24' }],
  ])('parses "%s"', (text, expected) => {
    expect(parseEntry(text)).toEqual(expected);
  });

  it('sorts lists by order and entries open first, then by order', () => {
    const l = (name: string, order: number, createdAt: number) => ({
      name,
      kind: 'checklist' as const,
      order,
      createdAt,
    });
    expect(sortLists([l('b', 2, 1), l('a', 0, 5), l('c', 2, 0)]).map((x) => x.name)).toEqual([
      'a',
      'c',
      'b',
    ]);
    const i = (name: string, done: boolean, order: number, createdAt: number) => ({
      listId: 'x',
      name,
      done,
      order,
      createdAt,
    });
    expect(
      sortItems([i('b', true, 0, 1), i('c', false, 2, 3), i('a', false, 1, 2)]).map((x) => x.name),
    ).toEqual(['a', 'c', 'b']);
  });

  it('detects duplicates among open entries only and counts progress', () => {
    const items = [
      { name: 'Milch', done: false },
      { name: 'Brot', done: true },
    ];
    expect(isDuplicate(items, ' milch ')).toBe(true);
    expect(isDuplicate(items, 'Brot')).toBe(false);
    expect(progress(items)).toEqual({ done: 1, total: 2, complete: false });
    expect(progress([{ done: true }]).complete).toBe(true);
    expect(progress([]).complete).toBe(false);
    expect(nextOrder([])).toBe(0);
    expect(nextOrder([{ order: 4 }, { order: 1 }])).toBe(5);
    expect(copyName('Camping', ['Camping'])).toBe('Kopie von Camping');
    expect(copyName('Camping', ['Kopie von Camping'])).toBe('Kopie von Camping (2)');
  });
});

describe('lists repo', () => {
  it('creates the shopping list once and never brings back a deleted one', async () => {
    await ensureShoppingList();
    await ensureShoppingList();
    expect(await listRepo.active().count()).toBe(1);
    expect(await listRepo.get(SHOPPING_LIST_ID)).toMatchObject({ kind: 'shopping', order: 0 });
    await listRepo.remove(SHOPPING_LIST_ID);
    await ensureShoppingList();
    expect(await listRepo.active().count()).toBe(0);
  });

  it('adds entries: shopping parses the quantity and ignores open duplicates, others keep the text', async () => {
    await ensureShoppingList();
    expect(await addItem(SHOPPING_LIST_ID, '2 Milch', 'shopping')).toBe(true);
    expect(await addItem(SHOPPING_LIST_ID, 'milch', 'shopping')).toBe(false);
    expect(await addItem(SHOPPING_LIST_ID, '  ', 'shopping')).toBe(false);
    const [milk] = await itemsOf(SHOPPING_LIST_ID);
    expect(milk).toMatchObject({ name: 'Milch', quantity: '2', done: false, order: 0 });
    await itemRepo.update(milk!.id, { done: true });
    expect(await addItem(SHOPPING_LIST_ID, 'Milch', 'shopping')).toBe(true); // bought: may be added again
    await listRepo.create({ name: 'Camping', kind: 'packing', order: 1 }, { id: 'camp' });
    expect(await addItem('camp', '2 Zelte', 'packing')).toBe(true);
    expect((await itemsOf('camp'))[0]).toMatchObject({ name: '2 Zelte' });
    expect((await itemsOf('camp'))[0]!.quantity).toBeUndefined();
  });

  it('removes bought entries only, resets, duplicates and deletes a list', async () => {
    await listRepo.create(
      { name: 'Camping', kind: 'packing', note: 'See', order: 1 },
      { id: 'camp' },
    );
    await itemRepo.create({ listId: 'camp', name: 'Zelt', done: true, order: 0 });
    await itemRepo.create({ listId: 'camp', name: 'Kocher', done: false, order: 1 });
    expect(await clearDone('camp')).toBe(1);
    expect((await itemsOf('camp')).map((i) => i.name)).toEqual(['Kocher']);
    await itemRepo.create({ listId: 'camp', name: 'Mütze', done: true, order: 2 });
    await resetList('camp');
    expect((await itemsOf('camp')).every((i) => !i.done)).toBe(true);

    const copyId = await duplicateList('camp');
    expect(await listRepo.get(copyId)).toMatchObject({
      name: 'Kopie von Camping',
      kind: 'packing',
      note: 'See',
    });
    expect((await itemsOf(copyId)).map((i) => i.name).sort()).toEqual(['Kocher', 'Mütze']);

    await deleteList('camp');
    expect(await listRepo.get('camp')).toBeUndefined();
    expect(await itemsOf('camp')).toEqual([]);
    expect((await itemsOf(copyId)).length).toBe(2);
  });

  it('shopping.requested lands on the shopping list once', async () => {
    await addRequested({ name: 'Butter' });
    await addRequested({ name: 'Butter' });
    await addRequested({ name: 'Mehl', quantity: '500 g' });
    const items = await itemsOf(SHOPPING_LIST_ID);
    expect(items.map((i) => [i.name, i.quantity])).toEqual([
      ['Butter', undefined],
      ['Mehl', '500 g'],
    ]);
  });
});
