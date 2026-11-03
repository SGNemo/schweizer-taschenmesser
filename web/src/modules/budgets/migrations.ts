import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: optional `currency` on budgets and goals (deposits follow their goal); a record without one is
 * in euro, so nothing is rewritten.
 * 3: optional `period`, `carryOver`, `warnAtPercent` on budgets and `monthlyRateMinor` on goals; absent
 * means "as before" (a monthly budget without carry-over), so nothing is rewritten.
 * 4: optional `startDate` on goals; absent means no pace line, so nothing is rewritten.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: () => Promise.resolve(),
  3: () => Promise.resolve(),
  4: () => Promise.resolve(),
};
