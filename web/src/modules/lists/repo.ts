import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { t } from '@/strings';
import {
  copyName,
  isDuplicate,
  moveOrders,
  nextOrder,
  parseEntry,
  pickShoppingTarget,
  recall,
  sortItems,
} from './logic';
import { itemSchema, listSchema, SHOPPING_LIST_ID, type ListKind } from './schema';

export const listRepo = createRepo(tableName('lists', 'list'), listSchema);
export const itemRepo = createRepo(tableName('lists', 'item'), itemSchema);

/** Live items of one list (tombstones excluded), in list order. */
export const itemsOf = async (listId: string) =>
  sortItems(
    (await itemRepo.table.where('listId').equals(listId).toArray()).filter(
      (i) => i.deletedAt === null,
    ),
  );

/**
 * Creates the default shopping list once. A tombstone counts as existing: whoever deleted the
 * list on purpose does not get it back.
 */
export async function ensureShoppingList(): Promise<void> {
  if (await listRepo.table.get(SHOPPING_LIST_ID)) return;
  await listRepo.createMany([
    { id: SHOPPING_LIST_ID, data: { name: t.lists.defaultShopping, kind: 'shopping', order: 0 } },
  ]);
}

/**
 * The list that receives items for "the shopping list" (pantry, quick capture, assistant, text import): the first
 * shopping list in use in the user's order. With none in use, a fresh install gets the default one; whoever deleted
 * or archived theirs gets a new one – the item was asked for, so it needs a place that is not hidden.
 */
export async function shoppingTargetId(): Promise<string> {
  const lists = await listRepo.active().toArray();
  const target = pickShoppingTarget(lists);
  if (target) return target.id;
  if (!(await listRepo.table.get(SHOPPING_LIST_ID))) {
    await ensureShoppingList();
    return SHOPPING_LIST_ID;
  }
  const created = await listRepo.create({
    name: t.lists.defaultShopping,
    kind: 'shopping',
    order: nextOrder(lists),
  });
  return created.id;
}

/** Moves a list one step up or down in the tab row (only the lists in use take part). */
export async function moveList(listId: string, step: -1 | 1): Promise<void> {
  for (const { id, order } of moveOrders(await listRepo.active().toArray(), listId, step))
    await listRepo.update(id, { order });
}

/** Puts a list away (out of the tab row) or back; an unarchived list goes to the end of the row. */
export async function setArchived(listId: string, archived: boolean): Promise<void> {
  if (archived) return listRepo.update(listId, { archived: true }).then(() => undefined);
  const lists = (await listRepo.active().toArray()).filter((l) => !l.archived);
  await listRepo.update(listId, { archived: undefined, order: nextOrder(lists) });
}

/**
 * Adds an entry typed by the user. On a shopping list "2 Milch" becomes quantity + name and an
 * open entry of the same name is not added twice. Returns false for blank input and duplicates.
 */
export async function addItem(
  listId: string,
  text: string,
  kind: ListKind,
  extra: { category?: string } = {},
): Promise<boolean> {
  const { name, quantity } =
    kind === 'shopping' ? parseEntry(text) : { name: text.trim(), quantity: undefined };
  if (!name) return false;
  const items = await itemsOf(listId);
  if (kind === 'shopping' && isDuplicate(items, name)) return false;
  // On a shopping list the entry lands in the section (and price) it had last time.
  const remembered = kind === 'shopping' ? recall(await historyOf(listId), name) : {};
  await itemRepo.create({
    listId,
    name,
    ...(quantity ? { quantity } : {}),
    ...remembered,
    ...(extra.category ? { category: extra.category } : {}),
    done: false,
    order: nextOrder(items),
  });
  return true;
}

/** Every row ever written to the list, removed ones included: the source for suggestions and recall. */
export const historyOf = (listId: string) =>
  itemRepo.table.where('listId').equals(listId).toArray();

/**
 * Removes everything that has been ticked off (tombstones, so the removal syncs). Recurring entries are
 * not removed but unticked: they are on the list again for the next trip.
 */
export async function clearDone(listId: string): Promise<number> {
  const done = (await itemsOf(listId)).filter((i) => i.done);
  await itemRepo.removeMany(done.filter((i) => !i.recurring).map((i) => i.id));
  for (const i of done.filter((x) => x.recurring)) await itemRepo.update(i.id, { done: false });
  return done.length;
}

/** Unticks everything, ready for the next trip. */
export async function resetList(listId: string): Promise<void> {
  for (const item of (await itemsOf(listId)).filter((i) => i.done)) {
    await itemRepo.update(item.id, { done: false });
  }
}

/** Copies a list with all entries (unticked) – a list doubles as a template for the next trip. */
export async function duplicateList(listId: string): Promise<string> {
  const source = await listRepo.get(listId);
  if (!source) throw new Error('list not found');
  const lists = await listRepo.active().toArray();
  const copy = await listRepo.create({
    name: copyName(
      source.name,
      lists.map((l) => l.name),
    ),
    kind: source.kind,
    note: source.note,
    ...(source.place ? { place: source.place } : {}),
    order: nextOrder(lists),
  });
  for (const item of await itemsOf(listId)) {
    await itemRepo.create({
      listId: copy.id,
      name: item.name,
      quantity: item.quantity,
      ...(item.category ? { category: item.category } : {}),
      ...(item.toBuy ? { toBuy: true } : {}),
      done: false,
      order: item.order,
    });
  }
  return copy.id;
}

/**
 * Moves an entry to another list, at its end. The entry keeps all its fields (a section or a category only shows
 * on a list of that kind), so moving it back loses nothing.
 */
export async function moveItem(itemId: string, toListId: string): Promise<void> {
  const item = await itemRepo.get(itemId);
  if (!item || item.listId === toListId) return;
  await itemRepo.update(itemId, { listId: toListId, order: nextOrder(await itemsOf(toListId)) });
}

/**
 * Deletes a list together with its entries (tombstones). "Zuletzt gelöscht" brings both back for 30 days
 * (`core/trash`: the entries are the list's children).
 */
export async function deleteList(listId: string): Promise<void> {
  await itemRepo.removeMany((await itemsOf(listId)).map((i) => i.id));
  await listRepo.remove(listId);
}
