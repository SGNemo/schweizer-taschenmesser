import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { itemSchema, listSchema } from './schema';
/**
 * RETIRED (0.5.0): packing lists are now lists of the module "lists".
 * The collections stay in the schema so sync, backup and older devices keep working; an app
 * migration copies their rows forward (`core/db/appMigrationSteps.ts`). Tables follow in package 6.
 */
const manifest: ModuleManifest = {
  id: 'packing',
  name: 'Packlisten',
  icon: 'luggage',
  version: 1,
  description:
    'Stillgelegt: Packlisten sind jetzt Listen im Modul Listen. Die Daten wurden übernommen.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      list: { schema: listSchema, indexes: [] },
      item: { schema: itemSchema, indexes: ['listId'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
