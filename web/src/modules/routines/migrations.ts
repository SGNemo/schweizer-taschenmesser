import type { ModuleManifest } from '@/core/modules/types';

/** Data migrations, keyed by target version (`manifest.version`). */
export const migrations: ModuleManifest['migrations'] = {
  // 2: routines gained optional steps, a time of day and the ticked steps of a turn. Nothing is rewritten: a
  // write would carry a new timestamp and, on a device that had not synced yet, could win over steps another
  // device added meanwhile (field LWW). `stepsOf` reads a missing list as none.
  2: async () => {},
};
