import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { linkSchema } from './schema';
/**
 * RETIRED (0.5.0): the links are now bookmarks of the kind "link" in the module "bookmarks".
 * The collections stay in the schema so sync, backup and older devices keep working; an app
 * migration copies their rows forward (`core/db/appMigrationSteps.ts`). Tables follow in package 6.
 */
const manifest: ModuleManifest = {
  id: 'launcher',
  name: 'Apps & Links',
  icon: 'external',
  version: 1,
  description:
    'Stillgelegt: die Links sind jetzt Lesezeichen in der Merkliste. Die Daten wurden übernommen.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      link: { schema: linkSchema, indexes: ['group'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
