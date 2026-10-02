import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { itemSchema } from './schema';
/**
 * RETIRED (0.5.0): the shopping list is now a list of the module "lists".
 * The collections stay in the schema so sync, backup and older devices keep working; an app
 * migration copies their rows forward (`core/db/appMigrationSteps.ts`). Tables follow in package 6.
 */
const manifest: ModuleManifest = {
  id: 'shopping',
  name: 'Einkaufsliste',
  icon: 'cart',
  version: 1,
  description:
    'Stillgelegt: der Einkauf ist jetzt eine Liste im Modul Listen. Die Daten wurden übernommen.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      item: { schema: itemSchema, indexes: ['done'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
