import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: optional `currency` on budgets and goals (deposits follow their goal); a record without one is
 * in euro, so nothing is rewritten.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: () => Promise.resolve(),
};
