import { z } from 'zod';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { articleSchema, feedSchema, feedStateSchema } from './schema';
/**
 * RETIRED (0.4.0): Nachrichten are no longer part of Nemo; stored feeds stay in the database.
 * The collections stay in the schema so sync, backup and older devices keep working; the pages,
 * widgets and import code are gone. Tables follow in package 6 of the module plan.
 */
const manifest: ModuleManifest = {
  id: 'news',
  name: 'Nachrichten',
  icon: 'note',
  version: 1,
  description:
    'Stillgelegt: Nachrichten gibt es nicht mehr. Die gespeicherten Daten bleiben erhalten.',
  retired: true,
  routes: [],
  dataSchema: {
    collections: {
      feed: { schema: feedSchema, indexes: ['category'] },
      // Fetched articles and fetch bookkeeping stay on the device (see `CollectionDef.local`).
      article: { schema: articleSchema, indexes: ['feedId', 'publishedAt'], local: true },
      feedstate: { schema: feedStateSchema, indexes: [], local: true },
    },
  },
  migrations,
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'retired' },
};

export default manifest;
