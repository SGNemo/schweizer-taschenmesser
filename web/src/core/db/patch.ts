import { deepEqual } from './util';

/**
 * The fields of `next` (an editor's values) that differ from `base` (the record as it was when the
 * editor opened). An editor saves only these, so a field changed meanwhile somewhere else (another
 * tab, a synced device) keeps its new value instead of being written back to the old one. A field
 * the user cleared is in the result as `undefined` (and is removed by `repo.update`).
 */
export function changedFields<T extends Record<string, unknown>>(
  base: object,
  next: T,
): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T & string)[]) {
    if (!deepEqual((base as Record<string, unknown>)[key], next[key])) out[key] = next[key];
  }
  return out;
}
