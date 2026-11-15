import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version.
 * v2 (package 5): optional day fields `from`/`to` (the day's time window) and assignment fields
 * `from`/`to` (a session's time inside it). Old rows stay valid as they are – a day without a window
 * plans exactly as before – so the step only records the shape version.
 * v3 (package 4b): optional item field `part` (Vormittag / Nachmittag / Abend). Lossless: an old row has no
 * part and plans exactly as before; no row is rewritten, so the step only records the shape version.
 * v4 (package 5b): optional `due.time` ('HH:mm', the deadline's hour). Lossless: an old due has no time and
 * reads as before; the plan places by day either way, so no row is rewritten.
 */
export const migrations: ModuleManifest['migrations'] = {
  2: async () => {},
  3: async () => {},
  4: async () => {},
};
