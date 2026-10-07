import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version. Example (bump manifest.version to 2 as well):
 *   2: (ctx) => ctx.forEachRecord('entry', (r) => ({ note: r.note ?? '' })),
 */
export const migrations: ModuleManifest['migrations'] = {
  // 2: tasks gained the optional fields `plannedFor` and `estimateMin`; old records stay valid as they are.
  2: async () => {},
};
