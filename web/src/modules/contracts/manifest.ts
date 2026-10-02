import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { contractSchema } from './schema';
/**
 * RETIRED (0.6.0): Verträge und Garantien sind jetzt Unterlagen (Modul Unterlagen).
 * The collection stays in the schema so sync, backup and older devices keep working; an app
 * migration copies its rows forward (`core/db/appMigrationSteps.ts`). Tables follow in package 6.
 */
const manifest: ModuleManifest = {
  id: 'contracts',
  name: 'Verträge & Garantien',
  icon: 'file',
  version: 1,
  description:
    'Stillgelegt: Verträge und Garantien sind jetzt Unterlagen – Modul Unterlagen. Die Daten wurden übernommen.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      contract: { schema: contractSchema, indexes: ['endDate'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
