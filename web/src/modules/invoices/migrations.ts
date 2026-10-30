import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: optional `repeat` / `repeatOf` (recurring invoices); existing records need no change.
 * 3: optional `currency`; a record without one is in euro, so nothing is rewritten.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: () => Promise.resolve(),
  3: () => Promise.resolve(),
};
