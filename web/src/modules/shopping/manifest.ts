import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { itemSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'shopping',
  name: 'Einkaufsliste',
  icon: 'cart',
  version: 1,
  description:
    'Einkaufsliste zum schnellen Hinzufügen und Abhaken, mit Mengen („2 Milch“) und „Gekauftes entfernen“.',
  routes: [
    {
      path: '/shopping',
      label: 'Einkauf',
      nav: true,
      component: () => import('./routes/ShoppingPage'),
    },
  ],
  dataSchema: { collections: { item: { schema: itemSchema, indexes: ['done'] } } },
  migrations,
  widgets: [
    {
      id: 'open',
      title: 'Einkauf',
      size: 's',
      component: () => import('./widgets/OpenItemsWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  order: 90,
  contributions: { quickAdd: [{ id: 'item', label: 'Einkaufsartikel', to: '/shopping?new=1' }] },
};

export default manifest;
