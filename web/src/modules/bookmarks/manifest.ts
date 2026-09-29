import { onboarding } from './onboarding';
import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { itemSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'bookmarks',
  name: 'Merkliste',
  icon: 'bookmark',
  version: 1,
  description:
    'Links, Lesestoff, Filme, Orte und Ideen merken – mit Tags, Filtern und Erledigt-Status. Auf dem Handy auch über „Teilen“ aus anderen Apps.',
  routes: [
    {
      path: '/bookmarks',
      label: 'Merkliste',
      nav: true,
      component: () => import('./routes/BookmarksPage'),
    },
  ],
  dataSchema: {
    collections: {
      item: { schema: itemSchema, indexes: ['done', 'kind', '*tags'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'recent',
      title: 'Merkliste',
      size: 's',
      component: () => import('./widgets/RecentWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'wide',
  order: 70,
  contributions: {
    onboarding: onboarding,
    quickAdd: [{ id: 'item', label: 'Merkzettel', to: '/bookmarks?new=1' }],
  },
};

export default manifest;
