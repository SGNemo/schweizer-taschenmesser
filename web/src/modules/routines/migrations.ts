import type { ModuleManifest } from '@/core/modules/types';

/** Data migrations, keyed by target version (`manifest.version`). */
export const migrations: ModuleManifest['migrations'] = {
  // 2: routines gained steps, a time of day and the ticked steps of a turn (all optional). Every routine so far is
  // a chore without steps: it gets an empty list, so every stored row has the field; everything else stays.
  2: (ctx) =>
    ctx.forEachRecord('routine', (r) => (Array.isArray(r.steps) ? undefined : { steps: [] })),
};
