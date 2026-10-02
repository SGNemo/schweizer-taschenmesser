import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { documentSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'vault',
  name: 'Dokumente',
  icon: 'files',
  version: 1,
  description:
    'Wichtige Dokumente mit Kategorie, Notiz und Ablaufdatum (z. B. Ausweis) und angehängter Datei. Dateien bleiben nur auf diesem Gerät.',
  routes: [
    {
      path: '/vault',
      label: 'Dokumente',
      nav: true,
      component: () => import('./routes/VaultPage'),
    },
  ],
  dataSchema: {
    collections: { document: { schema: documentSchema, indexes: ['category', 'expiresOn'] } },
  },
  migrations,
  widgets: [
    {
      id: 'expiring',
      title: 'Dokumente: Ablauf',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/ExpiringWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 150,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'document', label: 'Dokument', to: '/vault?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
