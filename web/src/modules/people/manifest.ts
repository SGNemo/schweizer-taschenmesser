import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { giftSchema, personSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'people',
  get name() {
    return t.people.meta.name;
  },
  icon: 'users',
  version: 1,
  get description() {
    return t.people.meta.description;
  },
  routes: [
    {
      path: '/people',
      get label() {
        return t.people.meta.route;
      },
      nav: true,
      component: () => import('./routes/PeoplePage'),
    },
  ],
  dataSchema: {
    collections: {
      person: {
        schema: personSchema,
        indexes: ['name'],
        example: { name: 'Beispielperson', birthday: { month: 3, day: 15 } },
      },
      gift: {
        schema: giftSchema,
        indexes: ['personId', 'status', 'date'],
        example: { personId: 'Beispielperson', title: 'Beispielbuch', priceCents: 1990 },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'next',
      get title() {
        return t.people.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/NextBirthdaysWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 100,
  area: 'plan',
  contributions: {
    onboarding,
    quickAdd: [
      {
        id: 'person',
        get label() {
          return t.people.meta.quickAdd;
        },
        to: '/people?new=1',
      },
    ],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    services: () => import('./services'),
  },
};

export default manifest;
