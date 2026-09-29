import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { subscriptionSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'subscriptions',
  name: 'Abos',
  icon: 'repeat',
  version: 1,
  description:
    'Abos und wiederkehrende Zahlungen: nächste Abbuchung, Kündigungsfrist und die Summe pro Monat und Jahr.',
  routes: [
    {
      path: '/subscriptions',
      label: 'Abos',
      nav: true,
      component: () => import('./routes/SubscriptionsPage'),
    },
  ],
  dataSchema: {
    collections: {
      subscription: { schema: subscriptionSchema, indexes: ['startDate'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'next',
      title: 'Nächste Abbuchungen',
      size: 's',
      component: () => import('./widgets/NextChargesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  layout: 'wide',
  order: 60,
  contributions: {
    quickAdd: [{ id: 'subscription', label: 'Abo', to: '/subscriptions?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    aiComputed: () => import('./aiComputed'),
  },
};

export default manifest;
