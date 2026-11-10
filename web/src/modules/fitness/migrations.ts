import type { ModuleManifest } from '@/core/modules/types';

/** Data migrations, keyed by target version. */
export const migrations: ModuleManifest['migrations'] = {
  // v2: optional `planned` on a session and the new `template` collection. Nothing to rewrite.
  2: async () => {},
};
