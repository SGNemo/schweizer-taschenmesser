import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version. Example (bump manifest.version to 2 as well):
 *   2: (ctx) => ctx.forEachRecord('entry', (r) => ({ note: r.note ?? '' })),
 */
export const migrations: ModuleManifest['migrations'] = {
  // Version 2 („Kopf leer“ 3a): cached thread headers may carry a derived `personal` flag (optional). Old
  // headers simply lack it until the list is fetched again; nothing to rewrite (they are sealed per row).
  2: async () => undefined,
};
