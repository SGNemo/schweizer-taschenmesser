import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { checkSchema, habitSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'habits',
  name: 'Habit-Tracker',
  icon: 'flame',
  version: 1,
  description:
    'Gewohnheiten an bestimmten Wochentagen abhaken, Serien (Streaks) und die letzten Tage im Blick.',
  routes: [
    {
      path: '/habits',
      label: 'Habits',
      nav: true,
      component: () => import('./routes/HabitsPage'),
    },
  ],
  dataSchema: {
    collections: {
      habit: { schema: habitSchema, indexes: ['archived'] },
      check: { schema: checkSchema, indexes: ['habitId', 'date'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'today',
      title: 'Habits heute',
      size: 's',
      component: () => import('./widgets/TodayWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'content',
  order: 110,
  contributions: { quickAdd: [{ id: 'habit', label: 'Gewohnheit', to: '/habits?new=1' }] },
};

export default manifest;
