import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { itemSchema, listSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'lists',
  name: t.lists.meta.name,
  icon: 'cart',
  version: 1,
  description: t.lists.meta.description,
  routes: [
    {
      path: '/lists',
      label: t.lists.meta.route,
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
      title: t.lists.meta.widget,
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/OpenListsWidget'),
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
    quickAdd: [{ id: 'item', label: t.lists.meta.quickAdd, to: '/lists?new=1' }],
    services: () => import('./services'),
    aiCreateDefaults: () => import('./aiDefaults'),
  },
};

export default manifest;
