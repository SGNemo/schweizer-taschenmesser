import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { subscriptionSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'subscriptions',
  name: t.subscriptions.meta.name,
  icon: 'repeat',
  version: 1,
  description: t.subscriptions.meta.description,
  routes: [
    {
      path: '/subscriptions',
      label: t.subscriptions.meta.route,
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
      title: t.subscriptions.meta.widget,
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/NextChargesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: ['finance'] },
  layout: 'wide',
  order: 60,
  area: 'money',
  contributions: {
    onboarding: onboarding,
    quickAdd: [
      { id: 'subscription', label: t.subscriptions.meta.quickAdd, to: '/subscriptions?new=1' },
    ],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    aiComputed: () => import('./aiComputed'),
  },
};

export default manifest;
