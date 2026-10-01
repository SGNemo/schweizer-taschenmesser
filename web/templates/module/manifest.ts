import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
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
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/SummaryWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  // layout: 'content', // page width: 'narrow' | 'content' | 'wide' | 'full' (default 'content')
  // order: 50, // lower = earlier in navigation and library (default 100)
  contributions: {
    // Start-data importers (see modules/todos/importer.ts); `noOnboarding` = nothing to import.
    onboarding: noOnboarding,
    quickAdd: [{ id: 'new', label: '__NAME__: neuer Eintrag', to: '/__ID__?new=1' }],
  },
};

export default manifest;
