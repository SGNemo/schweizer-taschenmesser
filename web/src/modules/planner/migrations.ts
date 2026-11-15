import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * v2 (package 5): optional day fields `from`/`to` (the day's time window) and assignment fields
 * `from`/`to` (a session's time inside it). Old rows stay valid as they are – a day without a window
 * plans exactly as before – so the step only records the shape version.
 * v3 (use case „Wochenende retten“, F2): optional item fields `part`, `asBreakOn`, `breakMin` and blocker field `isBreak`.
 * Every old row is valid as it is (nothing set = today's behaviour), no index changes: the step records the version.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: async () => {},
  3: async () => {},
};
