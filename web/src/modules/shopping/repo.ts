import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { itemSchema } from './schema';

export const itemRepo = createRepo(tableName('shopping', 'item'), itemSchema);

/** Removes everything that has been ticked off (tombstones, so the removal syncs). */
export async function clearBought(): Promise<number> {
  const ids = (await itemRepo.active().toArray()).filter((i) => i.done).map((i) => i.id);
  await itemRepo.removeMany(ids);
  return ids.length;
}
