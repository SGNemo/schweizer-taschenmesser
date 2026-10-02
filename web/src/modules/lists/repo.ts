import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { t } from '@/strings';
import { copyName, isDuplicate, nextOrder, parseEntry } from './logic';
import { itemSchema, listSchema, SHOPPING_LIST_ID, type ListKind } from './schema';

export const listRepo = createRepo(tableName('lists', 'list'), listSchema);
export const itemRepo = createRepo(tableName('lists', 'item'), itemSchema);

/** Live items of one list (tombstones excluded). */
export const itemsOf = async (listId: string) =>
  (await itemRepo.table.where('listId').equals(listId).toArray()).filter(
    (i) => i.deletedAt === null,
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
export async function addItem(listId: string, text: string, kind: ListKind): Promise<boolean> {
  const { name, quantity } =
    kind === 'shopping' ? parseEntry(text) : { name: text.trim(), quantity: undefined };
  if (!name) return false;
  const items = await itemsOf(listId);
  if (kind === 'shopping' && isDuplicate(items, name)) return false;
  await itemRepo.create({
    listId,
    name,
    ...(quantity ? { quantity } : {}),
    done: false,
    order: nextOrder(items),
  });
  return true;
}

/** Removes everything that has been ticked off (tombstones, so the removal syncs). */
export async function clearDone(listId: string): Promise<number> {
  const ids = (await itemsOf(listId)).filter((i) => i.done).map((i) => i.id);
  await itemRepo.removeMany(ids);
  return ids.length;
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
    order: nextOrder(lists),
  });
  for (const item of await itemsOf(listId)) {
    await itemRepo.create({
      listId: copy.id,
      name: item.name,
      quantity: item.quantity,
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
