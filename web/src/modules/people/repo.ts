import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { giftSchema, personSchema } from './schema';

export const personRepo = createRepo(tableName('people', 'person'), personSchema);
export const giftRepo = createRepo(tableName('people', 'gift'), giftSchema);

/** Live gifts of one person. */
export const giftsOf = async (personId: string) =>
  (await giftRepo.table.where('personId').equals(personId).toArray()).filter(
    (g) => g.deletedAt === null,
  );

/** Removes a person together with their gifts (tombstones, so the removal syncs). */
export async function deletePerson(id: string): Promise<void> {
  const gifts = await giftsOf(id);
  await giftRepo.removeMany(gifts.map((g) => g.id));
  await personRepo.remove(id);
}
