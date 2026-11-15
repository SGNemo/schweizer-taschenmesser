import type { ModuleManifest } from '@/core/modules/types';

export const migrations: ModuleManifest['migrations'] = {
  // 2: items gained `started` and `preview` (both optional or defaulted) and the kind "book".
  // Old records stay valid as they are.
  2: async () => {},
  // 3: the kinds "buy" and "try" (things to buy or to try out). Old records stay valid as they are.
  3: async () => {},
  // 4: optional `inPlan` and `planMinutes` ("In den Plan"). Old records stay valid as they are.
  4: async () => {},
};
