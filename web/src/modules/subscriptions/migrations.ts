import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: every subscription gets an (empty) price history; "gekündigt zum" uses the recurrence end.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: (ctx) => ctx.forEachRecord('subscription', (r) => ({ priceHistory: r.priceHistory ?? [] })),
};
