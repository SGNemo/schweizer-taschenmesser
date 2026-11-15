import type { ModuleManifest } from '@/core/modules/types';

/** Data migrations, keyed by target version. */
export const migrations: ModuleManifest['migrations'] = {
  // 2: a session may carry `ref` (`<module>:<id>` of the thing it was started for). Old sessions stay as they are.
  2: async () => {},
};
