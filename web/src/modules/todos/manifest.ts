import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { listSchema, taskSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'todos',
  name: 'ToDos',
  icon: 'checklist',
  version: 1,
  description: 'Aufgaben in Listen mit Prioritäten, Fälligkeitsdatum und Unteraufgaben.',
  routes: [
    { path: '/todos', label: 'ToDos', nav: true, component: () => import('./routes/TodosPage') },
  ],
  dataSchema: {
    collections: {
      list: { schema: listSchema, indexes: ['order'] },
      task: { schema: taskSchema, indexes: ['listId', 'dueDate', 'parentId'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'open',
      title: 'Offene ToDos',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/OpenTasksWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 20,
  area: 'plan',
  contributions: {
    attention: () => import('./attention'),
    onboarding: onboarding,
    quickAdd: [{ id: 'task', label: 'ToDo', to: '/todos?new=1' }],
    calendarItems: () => import('./calendar'),
    aiCreateDefaults: () => import('./aiDefaults'),
  },
};

export default manifest;
