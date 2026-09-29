import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { itemSchema, listSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'packing',
  name: 'Packlisten',
  icon: 'luggage',
  version: 1,
  description:
    'Packlisten für Reisen und Ausflüge: abhaken, zurücksetzen und als Vorlage für die nächste Reise kopieren.',
  routes: [
    {
      path: '/packing',
      label: 'Packlisten',
      nav: true,
      component: () => import('./routes/PackingPage'),
    },
  ],
  dataSchema: {
    collections: {
      list: { schema: listSchema, indexes: [] },
      item: { schema: itemSchema, indexes: ['listId'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'lists',
      title: 'Packlisten',
      size: 's',
      component: () => import('./widgets/ListsWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'content',
  order: 140,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'list', label: 'Packliste', to: '/packing?new=1' }],
  },
};

export default manifest;
