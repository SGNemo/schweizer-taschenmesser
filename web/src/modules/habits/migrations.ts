import type { ModuleManifest } from '@/core/modules/types';

/** Data migrations, keyed by target version (version 1 is the first of the new module). */
export const migrations: ModuleManifest['migrations'] = {
  // v2: optional `minutes` on a goal („Zeit im Plan freihalten“, planner hub S4). Nothing to rewrite.
  2: async () => {},
};
