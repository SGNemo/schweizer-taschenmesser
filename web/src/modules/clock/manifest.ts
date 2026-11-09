import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { placeSchema } from './schema';
import { settings } from './settings';

/**
 * Uhr: places whose time is always in view (widget on the overview, list page). Offline: the zones come from `Intl`,
 * the city names from `core/time/cities.ts`. No alarms, timers or meeting planner (decision: docs/decisions/modules.md).
 */
const manifest: ModuleManifest = {
  id: 'clock',
  get name() {
    return t.clock.meta.name;
  },
  icon: 'globe',
  // lime is free in Planen and shares neither head nor widget with Budgets (the other lime); the compact `fokus` head
  // shows the local time large, the `dial` mark beside it (MODULE-IDENTITY.md).
  identity: {
    hue: 'lime',
    hue2: 'fern',
    widget: 'kacheln',
    head: 'fokus',
    signature: 'dial',
  },
  version: 1,
  get description() {
    return t.clock.meta.description;
  },
  routes: [
    {
      path: '/clock',
      get label() {
        return t.clock.meta.name;
      },
      nav: true,
      component: () => import('./routes/ClockPage'),
    },
  ],
  dataSchema: {
    collections: {
      place: {
        schema: placeSchema,
        indexes: ['order'],
        example: { label: 'Büro Tokio', zone: 'Asia/Tokyo' },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'places',
      get title() {
        return t.clock.meta.widget;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/ClockWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'preview',
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  order: 47,
  area: 'plan',
  contributions: {
    onboarding: noOnboarding,
    aiCreateDefaults: () => import('./aiDefaults'),
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.clock.meta.quickAdd;
        },
        to: '/clock?new=1',
      },
    ],
  },
};

export default manifest;
