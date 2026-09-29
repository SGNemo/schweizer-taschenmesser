import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'example',
  name: 'Beispiel',
  icon: 'puzzle',
  version: 1,
  description:
    'Referenzmodul aus dem Generator: einfache Einträge mit Erledigt-Status. Dient als Vorlage und Testträger.',
  routes: [
    {
      path: '/example',
      label: 'Beispiel',
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
      title: 'Beispiel',
      size: 's',
      component: () => import('./widgets/SummaryWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  order: 5,
  // Reference module: visible in dev builds and E2E (VITE_INCLUDE_EXAMPLE=true) only.
  devOnly: true,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'new', label: 'Beispiel: neuer Eintrag', to: '/example?new=1' }],
  },
};

export default manifest;
