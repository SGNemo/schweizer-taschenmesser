import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * v2: optional person fields `phone`, `email`, `remindDaysBefore`, `giftBudgetCents`. Old rows stay valid
 * as they are, the step only records the shape version.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: async () => {},
};
