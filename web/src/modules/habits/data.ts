import { useLiveQuery } from 'dexie-react-hooks';
import type { Stored } from '@/core/db/types';
import { entryRepo, goalRepo } from './repo';
import type { Entry, Goal } from './schema';

/** Goals in the user's order (`undefined` while loading); archived ones only when asked for. */
export function useGoals(archived = false): Stored<Goal>[] | undefined {
  return useLiveQuery(
    async () =>
      (await goalRepo.active().sortBy('order')).filter((g) => Boolean(g.archived) === archived),
    [archived],
  );
}

/** Entries from `from` on (a day string), by the date index; the page keeps the window small. */
export function useEntries(from: string): Stored<Entry>[] | undefined {
  return useLiveQuery(
    async () => (await entryRepo.active().toArray()).filter((e) => e.date >= from),
    [from],
  );
}
