import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { migrations } from './migrations';
import { assignmentSchema, daySchema, itemSchema } from './schema';
import { settings } from './settings';

/**
 * Planer (docs/design/plan/CONCEPT.md): distributes the open things of the sources
 * (`contributions.plannable`, ToDos first) over the coming days. No `aiSchema` by decision 1 of
 * docs/decisions/plan.md (local-only replanning; the plan never reaches the assistant), `dataApi: false`
 * for the whole module (the plan, blocker labels and day notes describe the user's days).
 */
const manifest: ModuleManifest = {
  id: 'planner',
  get name() {
    return t.planner.meta.name;
  },
  icon: 'chartGantt',
  identity: {
    hue: 'indigo',
    hue2: 'cobalt',
    widget: 'fortschritt',
    head: 'standard',
    signature: 'weekBars',
    type: 'thin',
  },
  version: 2,
  get description() {
    return t.planner.meta.description;
  },
  routes: [
    {
      path: '/planner',
      get label() {
        return t.planner.meta.name;
      },
      nav: true,
      component: () => import('./routes/PlannerPage'),
    },
    {
      // Focus round of one session of the plan: the shell shows it without menus (`isFocusPath`).
      path: '/planner/focus/:item',
      get label() {
        return t.focus.mode.title;
      },
      layout: 'narrow',
      component: () => import('./routes/FocusPage'),
    },
  ],
  dataSchema: {
    collections: {
      day: { schema: daySchema, indexes: ['date'] },
      item: { schema: itemSchema, indexes: [] },
      assignment: { schema: assignmentSchema, indexes: ['date', 'itemKey'] },
    },
  },
  dataApi: false,
  migrations,
  widgets: [
    {
      id: 'week',
      get title() {
        return t.planner.meta.widget;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/WeekWidget'),
    },
  ],
  settings,
  // One event for rules (`planner.overloaded`); no `watch`, no `actions` (docs/decisions/plan.md).
  automation: () => import('./automation'),
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 2, dependsOn: ['todos'] },
  layout: 'split',
  order: 15,
  area: 'plan',
  requires: ['todos'],
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [
      {
        id: 'add',
        get label() {
          return t.planner.meta.quickAdd;
        },
        to: '/planner?new=1',
      },
    ],
    services: () => import('./services'),
    calendarItems: () => import('./calendar'),
  },
};

export default manifest;
