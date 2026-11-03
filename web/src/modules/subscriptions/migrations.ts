import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: every subscription gets an (empty) price history; "gekündigt zum" uses the recurrence end.
 */
/**
 * (3: optional `currency`; a record without one is in euro, so nothing is rewritten.)
 */
export const migrations: ModuleManifest['migrations'] = {
  2: (ctx) => ctx.forEachRecord('subscription', (r) => ({ priceHistory: r.priceHistory ?? [] })),
  3: () => Promise.resolve(),
  // 4: optional `trialEndsOn`, `category`, `paymentMethod`; absent means "as before", nothing is rewritten.
  4: () => Promise.resolve(),
};
