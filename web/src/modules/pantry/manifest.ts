import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { itemSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'pantry',
  get name() {
    return t.pantry.meta.name;
  },
  icon: 'package',
  identity: {
    hue: 'fern',
    hue2: 'moss',
    widget: 'kacheln',
    head: 'regal',
    signature: 'shelf',
  },
  version: 3,
  get description() {
    return t.pantry.meta.description;
  },
  routes: [
    {
      path: '/pantry',
      get label() {
        return t.pantry.meta.route;
      },
      nav: true,
      component: () => import('./routes/PantryPage'),
    },
  ],
  dataSchema: {
    collections: {
      item: {
        schema: itemSchema,
        indexes: ['expires'],
        example: { name: 'Beispielmilch', place: 'fridge', count: 2 },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'expiring',
      get title() {
        return t.pantry.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/ExpiringWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 3, dependsOn: [] },
  layout: 'content',
  order: 95,
  area: 'household',
  automation: () => import('./automation'),
  contributions: {
    attention: () => import('./attention'),
    onboarding: noOnboarding,
    quickAdd: [
      {
        id: 'item',
        get label() {
          return t.pantry.meta.quickAdd;
        },
        to: '/pantry?new=1',
      },
    ],
    calendarItems: () => import('./calendar'),
    services: () => import('./services'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
