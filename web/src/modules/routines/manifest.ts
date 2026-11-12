import { t } from '@/strings';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { routineSchema } from './schema';
import { settings } from './settings';

/**
 * Routinen / Putzplan (UI audit 2026-11, module package H-b): household routines with a room, an interval and a
 * rotation between names typed here. "dran" instead of a backlog: no red, no streak, nothing that counts days.
 */
const manifest: ModuleManifest = {
  id: 'routines',
  get name() {
    return t.routines.meta.name;
  },
  icon: 'repeat',
  identity: {
    hue: 'cobalt',
    widget: 'checkliste',
    head: 'standard',
    tabs: true,
    signature: 'cycle',
  },
  version: 1,
  get description() {
    return t.routines.meta.description;
  },
  routes: [
    {
      path: '/routines',
      get label() {
        return t.routines.meta.name;
      },
      nav: true,
      component: () => import('./routes/RoutinesPage'),
    },
  ],
  dataSchema: {
    collections: {
      routine: { schema: routineSchema, indexes: ['dueDate'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'due',
      get title() {
        return t.routines.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RoutinesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 1, dependsOn: [] },
  layout: 'reading',
  order: 92,
  area: 'household',
  contributions: {
    // Start templates to tick; no text importer: a routine is typed in a few seconds (name, Enter).
    onboarding,
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.routines.meta.quickAdd;
        },
        to: '/routines?new=1',
      },
    ],
    plannable: () => import('./plannable'),
  },
};

export default manifest;
