import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { eventSchema, externalEventSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'calendar',
  name: 'Kalender',
  icon: 'calendar',
  version: 1,
  description:
    'Termine in Monats-, Wochen- und Tagesansicht – zeigt auch Fälligkeiten und Fristen anderer Module (ToDos, Erinnerungen, Rechnungen, Abos, Verträge, Geburtstage, Vorräte).',
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
      external: { schema: externalEventSchema, indexes: ['startDate', 'source'], dataApi: false },
    },
  },
  migrations,
  widgets: [
    {
      id: 'today',
      title: 'Heute & Morgen',
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/TodayWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: [] },
  layout: 'full',
  order: 10,
  contributions: {
    onboarding: onboarding,
    quickAdd: [{ id: 'event', label: 'Termin', to: '/calendar?new=1' }],
    calendarItems: () => import('./calendar'),
    externalCalendar: () => import('./external'),
  },
};

export default manifest;
