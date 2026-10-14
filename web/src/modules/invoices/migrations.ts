import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: optional `repeat` / `repeatOf` (recurring invoices); existing records need no change.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: () => Promise.resolve(),
};
