import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version. Example (bump manifest.version to 2 as well):
 *   2: (ctx) => ctx.forEachRecord('entry', (r) => ({ note: r.note ?? '' })),
 */
export const migrations: ModuleManifest['migrations'] = {
  // 2: tasks gained the optional fields `plannedFor` and `estimateMin`; old records stay valid as they are.
  2: async () => {},
  // 3: tasks gained the optional `personId` ("Für"); old records stay valid as they are.
  3: async () => {},
  // 4: tasks gained the optional `startDate`, `tags`, `checklist`, `links`; lists the optional `kind` (project). Nothing to rewrite.
  4: async () => {},
  // 5: tasks gained the optional `planMark` (the planner's ownership mark on `plannedFor`). Nothing to rewrite.
  5: async () => {},
  // 6: tasks gained the optional `dueTime` (the deadline's hour) and `dueRemind` („1 Std vorher“, opt-in). Nothing to rewrite.
  6: async () => {},
};
