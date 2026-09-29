import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: '__ID__',
  name: '__NAME__',
  icon: 'puzzle',
  version: 1,
  description: 'TODO: one sentence describing what __NAME__ does.',
  routes: [
    {
      path: '/__ID__',
      label: '__NAME__',
      nav: true,
      component: () => import('./routes/MainPage'),
    },
  ],
  dataSchema: {
    collections: {
      entry: { schema: entrySchema, indexes: ['createdAt'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'summary',
      title: '__NAME__',
      size: 's',
      component: () => import('./widgets/SummaryWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  // order: 50, // lower = earlier in navigation and library (default 100)
  contributions: {
    quickAdd: [{ id: 'new', label: '__NAME__: neuer Eintrag', to: '/__ID__?new=1' }],
  },
};

export default manifest;
