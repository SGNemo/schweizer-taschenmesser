import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { checkId } from './logic';
import { checkSchema, habitSchema } from './schema';

export const habitRepo = createRepo(tableName('habits', 'habit'), habitSchema);
export const checkRepo = createRepo(tableName('habits', 'check'), checkSchema);

/** Ticks a day on or off. Idempotent: the deterministic id makes concurrent ticks on two devices one record. */
export async function setChecked(habitId: string, date: string, checked: boolean): Promise<void> {
  const id = checkId(habitId, date);
  const existing = await checkRepo.table.get(id);
  if (checked) {
    if (!existing) await checkRepo.create({ habitId, date }, { id });
    else if (existing.deletedAt !== null) await checkRepo.restore(id);
  } else if (existing && existing.deletedAt === null) {
    await checkRepo.remove(id);
  }
}

/** Deletes a habit together with its ticks. */
export async function deleteHabit(habitId: string): Promise<void> {
  const ids = (await checkRepo.table.where('habitId').equals(habitId).toArray())
    .filter((c) => c.deletedAt === null)
    .map((c) => c.id);
  await checkRepo.removeMany(ids);
  await habitRepo.remove(habitId);
}
