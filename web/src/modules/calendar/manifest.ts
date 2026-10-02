import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { eventSchema, externalEventSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'calendar',
  name: t.calendar.meta.name,
  icon: 'calendar',
  version: 1,
  description: t.calendar.meta.description,
  routes: [
    {
      path: '/calendar',
      label: t.calendar.meta.route,
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
      title: t.calendar.meta.widget,
      defaultSize: 'l',
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
  area: 'plan',
  contributions: {
    attention: () => import('./attention'),
    onboarding: onboarding,
    quickAdd: [{ id: 'event', label: t.calendar.meta.quickAdd, to: '/calendar?new=1' }],
    calendarItems: () => import('./calendar'),
    externalCalendar: () => import('./external'),
  },
};

export default manifest;
