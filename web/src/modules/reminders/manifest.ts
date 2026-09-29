import type { ModuleManifest } from '@/core/modules/types';
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
      size: 's',
      component: () => import('./widgets/NextRemindersWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  order: 30,
  contributions: {
    quickAdd: [{ id: 'reminder', label: 'Erinnerung', to: '/reminders?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
