import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { contractSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'contracts',
  name: 'Verträge & Garantien',
  icon: 'file',
  version: 1,
  description:
    'Verträge, Versicherungen und Garantien mit Laufzeitende und Kündigungsfrist – im Kalender und mit Erinnerung, bevor eine Frist verstreicht.',
  routes: [
    {
      path: '/contracts',
      label: 'Verträge',
      nav: true,
      component: () => import('./routes/ContractsPage'),
    },
  ],
  dataSchema: { collections: { contract: { schema: contractSchema, indexes: ['endDate'] } } },
  migrations,
  widgets: [
    {
      id: 'expiring',
      title: 'Fristen & Ablauf',
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
  order: 120,
  area: 'money',
  contributions: {
    onboarding,
    quickAdd: [{ id: 'contract', label: 'Vertrag', to: '/contracts?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
