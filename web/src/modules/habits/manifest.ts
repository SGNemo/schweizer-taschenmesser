import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { checkSchema, habitSchema } from './schema';
/**
 * RETIRED (0.4.0): Habit-Tracker is no longer part of Nemo; stored habits stay in the database.
 * The collections stay in the schema so sync, backup and older devices keep working; the pages,
 * widgets and import code are gone. Tables follow in package 6 of the module plan.
 */
const manifest: ModuleManifest = {
  id: 'habits',
  name: 'Habit-Tracker',
  icon: 'flame',
  version: 1,
  description: 'Stillgelegt: Habits gibt es nicht mehr. Die gespeicherten Daten bleiben erhalten.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      habit: { schema: habitSchema, indexes: ['archived'] },
      check: { schema: checkSchema, indexes: ['habitId', 'date'] },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
