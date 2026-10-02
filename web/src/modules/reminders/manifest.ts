import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { reminderSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'reminders',
  name: 'Erinnerungen',
  icon: 'bell',
  version: 1,
  description:
    'Einmalige und wiederkehrende Erinnerungen – täglich, wöchentlich, monatlich, jährlich.',
  routes: [
    {
      path: '/reminders',
      label: 'Erinnerungen',
      nav: true,
      component: () => import('./routes/RemindersPage'),
    },
  ],
  dataSchema: {
    collections: {
      reminder: { schema: reminderSchema, indexes: ['startDate'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'next',
      title: 'Nächste Erinnerungen',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/NextRemindersWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 30,
  area: 'plan',
  contributions: {
    onboarding: onboarding,
    quickAdd: [{ id: 'reminder', label: 'Erinnerung', to: '/reminders?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
