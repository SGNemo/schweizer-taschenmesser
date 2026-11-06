import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * v2 (package 5): optional day fields `from`/`to` (the day's time window) and assignment fields
 * `from`/`to` (a session's time inside it). Old rows stay valid as they are – a day without a window
 * plans exactly as before – so the step only records the shape version.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: async () => {},
};
