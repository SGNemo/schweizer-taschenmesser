/**
 * The seam between the mail cache and the search index (`searchIndex.ts`), in its own file so the cache can
 * tell the index about writes and deletes without an import cycle. The index itself lives only in memory.
 */
let generation = 0;
const forgetters = new Set<() => void>();

/** Bumped by every write of the mail cache (`cache.ts`): the next search rebuilds even within the same millisecond. */
export function touchSearchIndex(): void {
  generation += 1;
}
export const searchGeneration = (): number => generation;

/** The index registers how to forget its copy in memory. */
export function onDropSearchIndex(forget: () => void): void {
  forgetters.add(forget);
}

/** Forgets every index held in memory (the mail cache was deleted, an account removed). */
export function dropSearchIndex(): void {
  generation += 1;
  for (const forget of forgetters) forget();
}
