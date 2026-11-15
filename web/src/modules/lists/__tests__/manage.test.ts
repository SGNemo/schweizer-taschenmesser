import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { listTrash, restoreEntry } from '@/core/trash/trash';
import { iconOf, moveOrders, pickShoppingTarget, splitArchived } from '../logic';
import {
  deleteList,
  ensureShoppingList,
  itemRepo,
  itemsOf,
  listRepo,
  moveList,
  setArchived,
  shoppingTargetId,
} from '../repo';
import { listSchema, SHOPPING_LIST_ID } from '../schema';
import { addRequested } from '../services';
import aiDefaults from '../aiDefaults';

beforeEach(async () => {
  for (const name of ['lists_list', 'lists_item', '_outbox', '_meta', '_settings'])
    await db.table(name).clear();
});

const L = (id: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  createdAt: order,
  ...listSchema.parse({ name: id, order, ...extra }),
});

describe('managing lists (round 2026-11)', () => {
  it('accepts icon, colour and archive on a list; old rows stay valid', () => {
    expect(listSchema.parse({ name: 'Alt', kind: 'shopping' })).toEqual({
      name: 'Alt',
      kind: 'shopping',
      order: 0,
    });
    expect(listSchema.parse({ name: 'Neu', icon: 'gift', tone: 3, archived: true })).toMatchObject({
      icon: 'gift',
      tone: 3,
      archived: true,
    });
    expect(listSchema.safeParse({ name: 'X', tone: 6 }).success).toBe(false);
  });

  it('shows the kind icon unless the list has a known own one', () => {
    expect(iconOf({ kind: 'shopping' })).toBe('cart');
    expect(iconOf({ kind: 'packing', icon: 'gift' })).toBe('gift');
    expect(iconOf({ kind: 'checklist', icon: 'no-such-icon' })).toBe('checklist');
  });

  it('splits archived lists off and moves a list among the ones in use', () => {
    const lists = [L('a', 0), L('b', 0), L('c', 1, { archived: true }), L('d', 2)];
    expect(splitArchived(lists).active.map((l) => l.id)).toEqual(['a', 'b', 'd']);
    expect(splitArchived(lists).archived.map((l) => l.id)).toEqual(['c']);
    // Old data has equal keys: a move gives every list its position.
    expect(moveOrders(lists, 'd', -1)).toEqual([
      { id: 'd', order: 1 },
      { id: 'b', order: 2 },
    ]);
    expect(moveOrders(lists, 'a', -1)).toEqual([]);
    expect(moveOrders(lists, 'd', 1)).toEqual([]);
    expect(moveOrders(lists, 'c', 1)).toEqual([]);
  });

  it('the first shopping list in use is the target, archived ones are skipped', () => {
    const lists = [
      L('pack', 0, { kind: 'packing' }),
      L('old', 1, { kind: 'shopping', archived: true }),
      L('weekly', 2, { kind: 'shopping' }),
      L('party', 3, { kind: 'shopping' }),
    ];
    expect(pickShoppingTarget(lists)?.id).toBe('weekly');
    expect(pickShoppingTarget(lists.slice(0, 2))).toBeUndefined();
  });

  it('moveList renumbers the tab row in the database', async () => {
    await listRepo.create({ name: 'A', kind: 'checklist', order: 0 }, { id: 'a' });
    await listRepo.create({ name: 'B', kind: 'checklist', order: 0 }, { id: 'b' });
    await listRepo.create({ name: 'C', kind: 'checklist', order: 0 }, { id: 'c' });
    await moveList('c', -1);
    const order = splitArchived(await listRepo.active().toArray()).active.map((l) => l.id);
    expect(order).toEqual(['a', 'c', 'b']);
  });

  it('archiving keeps the entries; bringing back puts the list at the end', async () => {
    await listRepo.create({ name: 'A', kind: 'checklist', order: 0 }, { id: 'a' });
    await listRepo.create({ name: 'B', kind: 'checklist', order: 1 }, { id: 'b' });
    await itemRepo.create({ listId: 'a', name: 'Zelt', done: false, order: 0 });
    await setArchived('a', true);
    expect((await listRepo.get('a'))?.archived).toBe(true);
    expect(await itemsOf('a')).toHaveLength(1);
    await setArchived('a', false);
    const a = await listRepo.get('a');
    expect(a?.archived).toBeUndefined();
    expect(splitArchived(await listRepo.active().toArray()).active.map((l) => l.id)).toEqual([
      'b',
      'a',
    ]);
  });

  // Migration of the fixed list: `shopping-default` is an ordinary list now.
  it('the old fixed shopping list can be deleted; requests then go to the next shopping list', async () => {
    await ensureShoppingList();
    await listRepo.create({ name: 'Drogerie', kind: 'shopping', order: 5 }, { id: 'drug' });
    await deleteList(SHOPPING_LIST_ID);
    await addRequested({ name: 'Zahnpasta' });
    expect((await itemsOf('drug')).map((i) => i.name)).toEqual(['Zahnpasta']);
    expect(await aiDefaults('item')).toEqual({ listId: 'drug' });
    // The deleted list is not brought back.
    await ensureShoppingList();
    expect((await listRepo.get(SHOPPING_LIST_ID))?.deletedAt).not.toBeNull();
  });

  it('with no shopping list in use a request gets a new visible list, never a hidden one', async () => {
    await ensureShoppingList();
    await setArchived(SHOPPING_LIST_ID, true);
    const id = await shoppingTargetId();
    expect(id).not.toBe(SHOPPING_LIST_ID);
    const created = await listRepo.get(id);
    expect(created).toMatchObject({ kind: 'shopping', name: 'Einkauf' });
    expect(created?.archived).toBeUndefined();
    // A fresh install still starts with the fixed id (every device agrees on it).
    await db.table('lists_list').clear();
    expect(await shoppingTargetId()).toBe(SHOPPING_LIST_ID);
  });

  it('"Zuletzt gelöscht" brings a deleted list back with its entries', async () => {
    await listRepo.create({ name: 'Camping', kind: 'packing', order: 0 }, { id: 'camp' });
    await itemRepo.create({ listId: 'camp', name: 'Zelt', done: false, order: 0 });
    await itemRepo.create({ listId: 'camp', name: 'Kocher', done: true, order: 1 });
    await deleteList('camp');
    const entry = (await listTrash()).find((e) => e.kind === 'list');
    expect(entry?.title).toBe('Camping');
    await restoreEntry(entry!);
    expect((await itemsOf('camp')).map((i) => i.name).sort()).toEqual(['Kocher', 'Zelt']);
  });
});

it('every list icon has a name for the picker', async () => {
  const { LIST_ICONS } = await import('../logic');
  const { t } = await import('@/strings');
  const { lists: en } = await import('@/i18n/locales/en/lists');
  for (const id of LIST_ICONS) {
    expect(t.lists.iconNames[id]).toBeTruthy();
    expect(en.iconNames[id]).toBeTruthy();
  }
});
