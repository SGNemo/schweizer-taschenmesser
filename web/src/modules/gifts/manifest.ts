import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { ideaSchema } from './schema';
import { settings } from './settings';

/**
 * No `aiSchema` on purpose: gift ideas are a surprise. The assistant neither sees the module nor
 * searches it.
 */
const manifest: ModuleManifest = {
  id: 'gifts',
  name: 'Geschenkideen',
  icon: 'gift',
  version: 1,
  description:
    'Geschenkideen je Person und Anlass sammeln, Preis und Link festhalten und abhaken, was gekauft oder schon verschenkt ist.',
  routes: [
    {
      path: '/gifts',
      label: 'Geschenkideen',
      nav: true,
      component: () => import('./routes/GiftsPage'),
    },
  ],
  dataSchema: {
    collections: {
      idea: {
        schema: ideaSchema,
        indexes: ['status', 'date'],
        example: { title: 'Beispielbuch', forWhom: 'Beispielperson', priceCents: 1990 },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'open',
      title: 'Geschenkideen',
      size: 's',
      component: () => import('./widgets/SummaryWidget'),
    },
  ],
  settings,
  defaultEnabled: false,
  layout: 'content',
  order: 175,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'idea', label: 'Geschenkidee', to: '/gifts?new=1' }],
    calendarItems: () => import('./calendar'),
  },
};

export default manifest;
