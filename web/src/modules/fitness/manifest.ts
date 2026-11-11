import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { mealSchema, sessionSchema, templateSchema } from './schema';
import { settings } from './settings';

/**
 * Fitness (docs/features/fitness.md): training sessions and a rough kcal log, calm by design – no
 * streaks, no red for eating, no body data. Health-adjacent, so it stays out of the data API.
 */
const manifest: ModuleManifest = {
  id: 'fitness',
  get name() {
    return t.fitness.meta.name;
  },
  icon: 'dumbbell',
  identity: {
    hue: 'sky',
    hue2: 'ocean',
    widget: 'fortschritt',
    head: 'standard',
    tabs: true,
    signature: 'dumbbell',
  },
  version: 2,
  get description() {
    return t.fitness.meta.description;
  },
  routes: [
    {
      path: '/fitness',
      get label() {
        return t.fitness.meta.name;
      },
      nav: true,
      component: () => import('./routes/FitnessPage'),
    },
  ],
  dataSchema: {
    collections: {
      session: { schema: sessionSchema, indexes: ['date'] },
      meal: { schema: mealSchema, indexes: ['date'] },
      template: { schema: templateSchema, indexes: [] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'week',
      get title() {
        return t.fitness.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/FitnessWidget'),
    },
  ],
  aiSchema,
  settings,
  dataApi: false,
  defaultEnabled: false,
  maturity: 'preview',
  seed: { version: 3, dependsOn: [] },
  layout: 'content',
  order: 98,
  area: 'household',
  contributions: {
    onboarding,
    calendarItems: () => import('./calendar'),
    aiCreateDefaults: () => import('./aiDefaults'),
    plannable: () => import('./plannable'),
    attention: () => import('./attention'),
    quickAdd: [
      {
        id: 'session',
        get label() {
          return t.fitness.meta.quickAddSession;
        },
        to: '/fitness?new=session',
      },
      {
        id: 'meal',
        get label() {
          return t.fitness.meta.quickAddMeal;
        },
        to: '/fitness?view=food&new=meal',
      },
    ],
  },
};

export default manifest;
