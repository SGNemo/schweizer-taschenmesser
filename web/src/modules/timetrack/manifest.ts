import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { clientSchema, jobSchema, sessionSchema } from './schema';
import { settings } from './settings';

/**
 * Time tracking: start/stop in one click, projects with colour and rate, manual entries, breaks, week
 * and month report, CSV. New in the Planen group; the retired module of 0.4 left its tables behind
 * (`timetrack_project`, `timetrack_entry`), these collections have other names (decision: ui-shell, 2026-11-03).
 */
const manifest: ModuleManifest = {
  id: 'timetrack',
  get name() {
    return t.timetrack.meta.name;
  },
  icon: 'clock',
  identity: {
    hue: 'teal',
    hue2: 'ocean',
    widget: 'kennzahl',
    head: 'zeit',
    signature: 'stopwatch',
    type: 'mono',
  },
  version: 1,
  get description() {
    return t.timetrack.meta.description;
  },
  routes: [
    {
      path: '/timetrack',
      get label() {
        return t.timetrack.meta.name;
      },
      nav: true,
      component: () => import('./routes/TimetrackPage'),
    },
  ],
  dataSchema: {
    collections: {
      client: { schema: clientSchema, indexes: ['order'] },
      job: { schema: jobSchema, indexes: ['clientId', 'order'] },
      session: { schema: sessionSchema, indexes: ['date', 'jobId'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'timer',
      get title() {
        return t.timetrack.meta.widget;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/TimerWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  order: 40,
  area: 'plan',
  automation: () => import('./automation'),
  contributions: {
    onboarding: noOnboarding,
    services: () => import('./services'),
    quickAdd: [
      {
        id: 'new',
        get label() {
          return t.timetrack.meta.quickAdd;
        },
        to: '/timetrack?new=1',
      },
    ],
  },
};

export default manifest;
