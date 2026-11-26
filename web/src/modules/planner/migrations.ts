import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * v2 (package 5): optional day fields `from`/`to` (the day's time window) and assignment fields
 * `from`/`to` (a session's time inside it). Old rows stay valid as they are – a day without a window
 * plans exactly as before – so the step only records the shape version.
 * v3 (package 4b): optional item field `part` (Vormittag / Nachmittag / Abend). Lossless: an old row has no
 * part and plans exactly as before; no row is rewritten, so the step only records the shape version.
 * v4 (package 5b): optional `due.time` ('HH:mm', the deadline's hour). Lossless: an old due has no time and
 * reads as before; the plan places by day either way, so no row is rewritten.
 * v5: optional item field `skipped` (the day of a passed training let go, `passed.ts`). Lossless: an old row has
 * none and the run never reads it, so no row is rewritten.
 * v6 (planner rethink): optional assignment field `locked` („fest“ lives on the placement row). Lossless: an old row
 * has none. The pins of before become locks in `migrateModel.ts` (it reads two collections and the clock, so it
 * is no per-record step).
 * v7 (package 8): optional item field `measured` and the collection `measure`. Lossless: an old row has no flag and
 * reads as before; a new collection starts empty, so no row is rewritten.
 * v8 (package 11): the collection `topic`. A new collection starts empty: no row is rewritten.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: async () => {},
  3: async () => {},
  4: async () => {},
  5: async () => {},
  6: async () => {},
  7: async () => {},
  8: async () => {},
};
