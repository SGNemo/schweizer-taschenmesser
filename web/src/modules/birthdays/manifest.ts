import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { birthdaySchema } from './schema';
/**
 * RETIRED (0.6.0): Geburtstage gehören jetzt zu den Personen (Modul Personen).
 * The collection stays in the schema so sync, backup and older devices keep working; an app
 * migration copies its rows forward (`core/db/appMigrationSteps.ts`). Tables follow in package 6.
 */
const manifest: ModuleManifest = {
  id: 'birthdays',
  name: 'Geburtstage',
  icon: 'cake',
  version: 1,
  description:
    'Stillgelegt: Geburtstage gehören jetzt zu den Personen – Modul Personen. Die Daten wurden übernommen.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      birthday: { schema: birthdaySchema, indexes: ['month'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
