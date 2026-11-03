import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version. Example (bump manifest.version to 2 as well):
 *   2: (ctx) => ctx.forEachRecord('entry', (r) => ({ note: r.note ?? '' })),
 */
export const migrations: ModuleManifest['migrations'] = {
  // 2: optional `repeat` / `repeatOf` on transactions; existing bookings need no change.
  2: () => Promise.resolve(),
  // 3: optional `currency` on accounts; an account without one is in euro, so nothing is rewritten.
  3: () => Promise.resolve(),
  // 4: optional `kind` on accounts, `parentId`/`icon` on categories, `transferId`/`splits` and the
  // `weekly` repeat on bookings; all absent means "as before", so nothing is rewritten.
  4: () => Promise.resolve(),
};
