import { createRepo } from '@/core/db/repo';
import { tableName } from '@/core/db/schema';
import type { Stored } from '@/core/db/types';
import { entrySchema, goalSchema, type Entry } from './schema';

export const goalRepo = createRepo(tableName('habits', 'goal'), goalSchema);
export const entryRepo = createRepo(tableName('habits', 'entry'), entrySchema);

/** One entry per goal and day: the fixed id lets two devices converge on one record. */
export const entryId = (goalId: string, date: string): string => `${goalId}:${date}`;

/** Sets the day's entry (creates it when missing). */
export async function setEntry(
  goalId: string,
  date: string,
  patch: Partial<Pick<Entry, 'count' | 'skipped'>>,
): Promise<Stored<Entry>> {
  const id = entryId(goalId, date);
  const existing = await entryRepo.get(id);
  if (existing) return (await entryRepo.update(id, patch)) ?? existing;
  return entryRepo.create({ goalId, date, count: 0, ...patch }, { id });
}

/** +1 (or -1, never below 0) on a day; a rest day is lifted by counting. */
export async function bump(goalId: string, date: string, by: number): Promise<void> {
  const existing = await entryRepo.get(entryId(goalId, date));
  const count = Math.max(0, (existing?.count ?? 0) + by);
  await setEntry(goalId, date, { count, skipped: undefined });
}

/** Archives a goal; the entries stay. */
export const archiveGoal = (id: string, archived: boolean) =>
  goalRepo.update(id, { archived: archived || undefined });
