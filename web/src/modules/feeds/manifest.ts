import { t } from '@/strings';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { feedExample, feedSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'feeds',
  get name() {
    return t.feeds.meta.name;
  },
  icon: 'wifi',
  // Identity v3: the neighbours in the knowledge area by id are Browser (schreib) and E-Mail (kennzahl), so the head is `regal`.
  identity: {
    hue: 'moss',
    hue2: 'lime',
    widget: 'kennzahl',
    head: 'standard',
    signature: 'masthead',
    type: 'serif',
  },
  version: 1,
  get description() {
    return t.feeds.meta.description;
  },
  routes: [
    {
      path: '/feeds',
      get label() {
        return t.feeds.meta.name;
      },
      nav: true,
      component: () => import('./routes/MainPage'),
    },
  ],
  dataSchema: {
    collections: {
      feed: {
        schema: feedSchema,
        indexes: ['createdAt'],
        example: feedExample,
      },
    },
  },
  migrations,
  settings,
  widgets: [
    {
      id: 'summary',
      get title() {
        return t.feeds.meta.name;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/SummaryWidget'),
    },
  ],
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  area: 'knowledge',
  contributions: {
    // Start-data importers (see modules/todos/importer.ts); `noOnboarding` = nothing to import.
    onboarding,
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.feeds.meta.quickAdd;
        },
        to: '/feeds?new=1',
      },
    ],
  },
};

export default manifest;
