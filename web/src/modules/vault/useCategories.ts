import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { resolveCategories, type ResolvedCategory } from './categories';
import { categoryRepo } from './repo';

/**
 * The live folders (built-in ones merged with what the user changed), "Ohne Kategorie" last. Until the table is
 * read the built-in folders show, so nothing jumps on the first paint.
 */
export function useCategories(): ResolvedCategory[] {
  // The whole table, tombstones too: `resolveCategories` decides what a removed or reset record means.
  const records = useLiveQuery(() => categoryRepo.table.toArray(), []);
  return useMemo(() => resolveCategories(records ?? []), [records]);
}
