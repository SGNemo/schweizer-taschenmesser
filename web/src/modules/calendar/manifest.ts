import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { calendarSchema, eventSchema, externalEventSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'calendar',
  get name() {
    return t.calendar.meta.name;
  },
  icon: 'calendar',
  identity: {
    hue: 'sky',
    hue2: 'ocean',
    widget: 'zeitleiste',
    head: 'standard',
    tabs: true,
    signature: 'calendarLeaf',
  },
  version: 4,
  get description() {
    return t.calendar.meta.description;
  },
  routes: [
    {
      path: '/calendar',
      get label() {
        return t.calendar.meta.route;
      },
      nav: true,
      component: () => import('./routes/CalendarPage'),
    },
  ],
  dataSchema: {
    collections: {
      event: { schema: eventSchema, indexes: ['startDate'] },
      calendar: { schema: calendarSchema, indexes: ['order'], dataApi: false },
      external: { schema: externalEventSchema, indexes: ['startDate', 'source'], dataApi: false },
    },
  },
  migrations,
  widgets: [
    {
      id: 'today',
      get title() {
        return t.calendar.meta.widget;
      },
      defaultSize: 'l',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/TodayWidget'),
    },
    {
      id: 'next',
      get title() {
        return t.widgets.next;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      // One figure ("in 20 Min"), not a time rail: the card has the shape of its content.
      variant: 'kennzahl',
      component: () => import('./widgets/NextWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  maturity: 'stable',
  seed: { version: 4, dependsOn: [] },
  layout: 'full',
  order: 10,
  area: 'plan',
  automation: () => import('./automation'),
  contributions: {
    attention: () => import('./attention'),
    onboarding: onboarding,
    quickAdd: [
      {
        id: 'event',
        get label() {
          return t.calendar.meta.quickAdd;
        },
        to: '/calendar?new=1',
      },
    ],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    aiCreateDefaults: () => import('./aiDefaults'),
    services: () => import('./services'),
    externalCalendar: () => import('./external'),
  },
};

export default manifest;
