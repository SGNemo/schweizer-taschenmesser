import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { listSchema, taskSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'todos',
  get name() {
    return t.todos.meta.name;
  },
  icon: 'checklist',
  version: 2,
  get description() {
    return t.todos.meta.description;
  },
  routes: [
    {
      path: '/todos',
      get label() {
        return t.todos.meta.route;
      },
      nav: true,
      component: () => import('./routes/TodosPage'),
    },
    {
      // Focus screen: the shell shows it without menus (`isFocusPath`).
      path: '/todos/focus/:taskId',
      get label() {
        return t.focus.mode.title;
      },
      layout: 'narrow',
      component: () => import('./routes/FocusPage'),
    },
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
      id: 'next',
      get title() {
        return t.focus.next.title;
      },
      defaultSize: 'l',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/NextWidget'),
    },
    {
      id: 'open',
      get title() {
        return t.todos.meta.widget;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/OpenTasksWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 2, dependsOn: [] },
  layout: 'wide',
  order: 20,
  area: 'plan',
  contributions: {
    attention: () => import('./attention'),
    notifications: () => import('./notifications'),
    onboarding: onboarding,
    quickAdd: [
      {
        id: 'task',
        get label() {
          return t.todos.meta.quickAdd;
        },
        to: '/todos?new=1',
      },
    ],
    calendarItems: () => import('./calendar'),
    aiCreateDefaults: () => import('./aiDefaults'),
  },
};

export default manifest;
