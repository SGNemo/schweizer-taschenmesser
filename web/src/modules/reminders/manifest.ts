import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { reminderSchema } from './schema';
/**
 * RETIRED (0.7.0): reminders are events of the kind "reminder" in the calendar.
 * The collection stays in the schema so sync, backup and older devices keep working; an app
 * migration copies its rows forward (`core/db/appMigrationSteps.ts`). Tables follow in package 6.
 */
const manifest: ModuleManifest = {
  id: 'reminders',
  name: 'Erinnerungen',
  icon: 'bell',
  version: 1,
  description:
    'Stillgelegt: Erinnerungen sind jetzt Termine der Art Erinnerung im Kalender. Die Daten wurden übernommen.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      reminder: { schema: reminderSchema, indexes: ['startDate'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
