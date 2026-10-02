import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { entrySchema, projectSchema } from './schema';
/**
 * RETIRED (0.4.0): Zeiterfassung is no longer part of Nemo; stored entries stay in the database.
 * The collections stay in the schema so sync, backup and older devices keep working; the pages,
 * widgets and import code are gone. Tables follow in package 6 of the module plan.
 */
const manifest: ModuleManifest = {
  id: 'timetrack',
  name: 'Zeiterfassung',
  icon: 'clock',
  version: 1,
  description:
    'Stillgelegt: Zeiterfassung gibt es nicht mehr. Die gespeicherten Daten bleiben erhalten.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      project: { schema: projectSchema, indexes: ['archived'] },
      entry: { schema: entrySchema, indexes: ['date', 'projectId'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
