import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { documentSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'vault',
  name: t.vault.meta.name,
  icon: 'files',
  version: 2,
  description: t.vault.meta.description,
  routes: [
    {
      path: '/vault',
      label: t.vault.meta.route,
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
      title: t.vault.meta.widget,
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
  area: 'vault',
  contributions: {
    attention: () => import('./attention'),
    onboarding,
    quickAdd: [{ id: 'document', label: t.vault.meta.quickAdd, to: '/vault?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
