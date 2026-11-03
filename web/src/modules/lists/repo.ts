import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { t } from '@/strings';
import { copyName, isDuplicate, nextOrder, parseEntry, recall, sortItems } from './logic';
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

/** Deletes a list together with its entries (tombstones). */
export async function deleteList(listId: string): Promise<void> {
  await itemRepo.removeMany((await itemsOf(listId)).map((i) => i.id));
  await listRepo.remove(listId);
}
