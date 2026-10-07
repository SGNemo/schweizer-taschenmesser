import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: '__ID__',
  get name() {
    return t.__ID__.meta.name;
  },
  icon: 'puzzle',
  version: 1,
  get description() {
    return t.__ID__.meta.description;
  },
  routes: [
    {
      path: '/__ID__',
      get label() {
        return t.__ID__.meta.name;
      },
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
      get title() {
        return t.__ID__.meta.name;
      },
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
  area: 'knowledge', // navigation area: plan | money | household | knowledge | vault | system
  // order: 50, // lower = earlier in navigation and library (default 100)
  contributions: {
    // Start-data importers (see modules/todos/importer.ts); `noOnboarding` = nothing to import.
    onboarding: noOnboarding,
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.__ID__.meta.quickAdd;
        },
        to: '/__ID__?new=1',
      },
    ],
  },
};

export default manifest;
