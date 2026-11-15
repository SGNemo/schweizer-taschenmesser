import type { ModuleManifest } from '@/core/modules/types';

/** Data migrations, keyed by target version. */
export const migrations: ModuleManifest['migrations'] = {
  // v2: optional `planned` on a session and the new `template` collection. Nothing to rewrite.
  2: async () => {},
  // v3: optional `log` (single sets) and `superset` on an exercise. Nothing to rewrite.
  3: async () => {},
  // v4: optional `weekdays` on a template (training plan). Nothing to rewrite.
  4: async () => {},
};
