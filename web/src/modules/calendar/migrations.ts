import type { ModuleManifest } from '@/core/modules/types';

/**
 * Data migrations, keyed by target version. Example (bump manifest.version to 2 as well):
 *   2: (ctx) => ctx.forEachRecord('entry', (r) => ({ note: r.note ?? '' })),
 */
export const migrations: ModuleManifest['migrations'] = {
  // 2: events gained the optional `personId` ("Für"); old records stay valid as they are.
  2: async () => {},
  // 3: events gained the optional `exdates` (skipped occurrences of a recurring event).
  3: async () => {},
  // 4: named calendars (`calendar_calendar`) and the optional `calendarId` on events; nothing to rewrite.
  4: async () => {},
};
