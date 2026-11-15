import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * 2: optional `repeat` / `repeatOf` (recurring invoices); existing records need no change.
 * 3: optional `currency`; a record without one is in euro, so nothing is rewritten.
 * 4: optional `payments`, `dunningLevel`, `dunnedAt`, `iban`, `bic`, `attachment`; absent means "as before".
 * 5: optional `dunnedDueDate`, `dunnedAmountMinor` (what a noted reminder claims); absent means "as before" –
 *    a reminder noted earlier keeps its note line, which the plan row still reads.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: () => Promise.resolve(),
  3: () => Promise.resolve(),
  4: () => Promise.resolve(),
  5: () => Promise.resolve(),
};
