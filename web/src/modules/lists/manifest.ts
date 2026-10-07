import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { itemSchema, listSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'lists',
  get name() {
    return t.lists.meta.name;
  },
  icon: 'cart',
  version: 1,
  get description() {
    return t.lists.meta.description;
  },
  routes: [
    {
      path: '/lists',
      get label() {
        return t.lists.meta.route;
      },
      nav: true,
      component: () => import('./routes/ListsPage'),
    },
  ],
  dataSchema: {
    collections: {
      list: { schema: listSchema, indexes: ['kind'] },
      item: { schema: itemSchema, indexes: ['listId', 'done'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'open',
      get title() {
        return t.lists.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/OpenListsWidget'),
    },
    {
      id: 'packing',
      get title() {
        return t.lists.meta.widgetPacking;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/PackingWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  order: 90,
  area: 'household',
  contributions: {
    onboarding,
    quickAdd: [
      {
        id: 'item',
        get label() {
          return t.lists.meta.quickAdd;
        },
        to: '/lists?new=1',
      },
    ],
    services: () => import('./services'),
    aiCreateDefaults: () => import('./aiDefaults'),
  },
};

export default manifest;
