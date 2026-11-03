import type { ModuleManifest } from '@/core/modules/types';

export const migrations: ModuleManifest['migrations'] = {
  // 2: items gained `started` and `preview` (both optional or defaulted) and the kind "book".
  // Old records stay valid as they are.
  2: async () => {},
};
