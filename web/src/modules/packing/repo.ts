import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { copyName } from './logic';
import { itemSchema, listSchema } from './schema';

export const listRepo = createRepo(tableName('packing', 'list'), listSchema);
export const itemRepo = createRepo(tableName('packing', 'item'), itemSchema);

const itemsOf = async (listId: string) =>
  (await itemRepo.table.where('listId').equals(listId).toArray()).filter(
    (i) => i.deletedAt === null,
  );

/** Unpacks everything, ready for the next trip. */
export async function resetList(listId: string): Promise<void> {
  for (const item of (await itemsOf(listId)).filter((i) => i.packed)) {
    await itemRepo.update(item.id, { packed: false });
  }
}

/** Copies a list with all items (unpacked) – a list doubles as a template for the next trip. */
export async function duplicateList(listId: string): Promise<string> {
  const source = await listRepo.get(listId);
  if (!source) throw new Error('list not found');
  const names = (await listRepo.active().toArray()).map((l) => l.name);
  const copy = await listRepo.create({ name: copyName(source.name, names), note: source.note });
  for (const item of await itemsOf(listId)) {
    await itemRepo.create({ listId: copy.id, name: item.name, packed: false, order: item.order });
  }
  return copy.id;
}

/** Deletes a list together with its items (tombstones). */
export async function deleteList(listId: string): Promise<void> {
  await itemRepo.removeMany((await itemsOf(listId)).map((i) => i.id));
  await listRepo.remove(listId);
}
