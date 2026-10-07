import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'example',
  get name() {
    return t.example.name;
  },
  icon: 'puzzle',
  version: 1,
  get description() {
    return t.example.description;
  },
  routes: [
    {
      path: '/example',
      get label() {
        return t.example.name;
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
        return t.example.name;
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
  order: 5,
  area: 'knowledge',
  // Reference module: visible in dev builds and E2E (VITE_INCLUDE_EXAMPLE=true) only.
  devOnly: true,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.example.quickAdd;
        },
        to: '/example?new=1',
      },
    ],
  },
};

export default manifest;
