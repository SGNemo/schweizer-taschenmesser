import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema, goalSchema } from './schema';
import { settings } from './settings';

/**
 * Habits: goals with rings (a tick or a number), rest days that never count against you, a year grid
 * and calm reminders. New in the Planen group; the retired module of 0.4 left its tables behind
 * (`habits_habit`, `habits_check`), these collections have other names (decision: ui-shell, 2026-11-03).
 */
const manifest: ModuleManifest = {
  id: 'habits',
  get name() {
    return t.habits.meta.name;
  },
  icon: 'target',
  identity: {
    hue: 'violet',
    hue2: 'orchid',
    widgetType: 'progress',
    widget: 'fortschritt',
    head: 'fortschritt',
    signature: 'ring',
    feedback: 'ring',
  },
  version: 1,
  get description() {
    return t.habits.meta.description;
  },
  routes: [
    {
      path: '/habits',
      get label() {
        return t.habits.meta.name;
      },
      nav: true,
      component: () => import('./routes/HabitsPage'),
    },
  ],
  dataSchema: {
    collections: {
      goal: { schema: goalSchema, indexes: ['order'] },
      entry: { schema: entrySchema, indexes: ['goalId', 'date'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'today',
      get title() {
        return t.habits.meta.widget;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/HabitsWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  order: 30,
  area: 'plan',
  automation: () => import('./automation'),
  contributions: {
    onboarding: noOnboarding,
    notifications: () => import('./notifications'),
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.habits.meta.quickAdd;
        },
        to: '/habits?new=1',
      },
    ],
  },
};

export default manifest;
