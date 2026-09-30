import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { birthdaySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'birthdays',
  name: 'Geburtstage',
  icon: 'cake',
  version: 1,
  description: 'Geburtstage nie mehr vergessen: jährlich im Kalender, mit Alter und Erinnerung.',
  routes: [
    {
      path: '/birthdays',
      label: 'Geburtstage',
      nav: true,
      component: () => import('./routes/BirthdaysPage'),
    },
  ],
  dataSchema: { collections: { birthday: { schema: birthdaySchema, indexes: ['month'] } } },
  migrations,
  widgets: [
    {
      id: 'next',
      title: 'Nächste Geburtstage',
      size: 's',
      component: () => import('./widgets/NextBirthdaysWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'wide',
  order: 100,
  contributions: {
    quickAdd: [{ id: 'birthday', label: 'Geburtstag', to: '/birthdays?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
