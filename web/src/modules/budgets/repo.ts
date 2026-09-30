import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import { budgetSchema, depositSchema, goalSchema } from './schema';

export const budgetRepo = createRepo(tableName('budgets', 'budget'), budgetSchema);
export const goalRepo = createRepo(tableName('budgets', 'goal'), goalSchema);
export const depositRepo = createRepo(tableName('budgets', 'deposit'), depositSchema);

/** Deletes a goal together with its deposits (tombstones). */
export async function deleteGoal(goalId: string): Promise<void> {
  const ids = (await depositRepo.table.where('goalId').equals(goalId).toArray())
    .filter((d) => d.deletedAt === null)
    .map((d) => d.id);
  await depositRepo.removeMany(ids);
  await goalRepo.remove(goalId);
}
