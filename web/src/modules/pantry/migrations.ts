import type { ModuleManifest } from '@/core/modules/types';

export const migrations: ModuleManifest['migrations'] = {
  // v2: optional `unit` field. Nothing to rewrite; the step only records the shape version.
  2: async () => {},
};
