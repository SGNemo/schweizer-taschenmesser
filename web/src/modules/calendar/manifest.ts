import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { eventSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'calendar',
  name: 'Kalender',
  icon: 'calendar',
  version: 1,
  description:
    'Termine in Monats-, Wochen- und Tagesansicht – zeigt auch Fälligkeiten anderer Module (ToDos, Erinnerungen, später Rechnungen und Abos).',
  routes: [
    {
      path: '/calendar',
      label: 'Kalender',
      nav: true,
      component: () => import('./routes/CalendarPage'),
    },
  ],
  dataSchema: {
    collections: {
      event: { schema: eventSchema, indexes: ['startDate'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'today',
      title: 'Heute & Morgen',
      size: 'm',
      component: () => import('./widgets/TodayWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  layout: 'full',
  order: 10,
  contributions: {
    quickAdd: [{ id: 'event', label: 'Termin', to: '/calendar?new=1' }],
    calendarItems: () => import('./calendar'),
  },
};

export default manifest;
