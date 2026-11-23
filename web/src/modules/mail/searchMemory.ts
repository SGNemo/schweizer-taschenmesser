/**
 * Where the search index lives: this map in memory, nowhere else (`searchIndex.ts`). Its own file so the cache
 * can forget it on delete without an import cycle.
 */
const built = new Map<string, { signature: string; docs: unknown[] }>();

export const searchMemory = built;

let generation = 0;

/** Bumped by every write of the mail cache (`cache.ts`): the next search rebuilds even within the same millisecond. */
export function touchSearchIndex(): void {
  generation += 1;
}
export const searchGeneration = (): number => generation;

/** Forgets every index held in memory (the mail cache was deleted, an account removed). */
export function dropSearchIndex(): void {
  generation += 1;
  built.clear();
}
