import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { settings } from './settings';

/**
 * The phone as a remote control of the paired PC (Android only): media and volume for now, the
 * touchpad and the keyboard come with later packages. Holds no data: what the PC plays or how loud
 * it is lives in memory while the page is open and is never stored, synced, backed up, searched
 * or offered to the assistant – hence no collections, no `aiSchema`, `dataApi: false` (and
 * blocked by id in `core/dataapi/scope.ts`). What this phone may do is decided at the PC alone
 * (`docs/rules/remote-control.md`).
 */
const manifest: ModuleManifest = {
  id: 'remote',
  get name() {
    return t.remote.meta.name;
  },
  icon: 'monitor',
  identity: {
    hue: 'fern',
    widget: 'status',
    head: 'schreib',
    signature: 'display',
  },
  version: 1,
  get description() {
    return t.remote.meta.description;
  },
  platforms: ['android'],
  routes: [
    {
      path: '/remote',
      get label() {
        return t.remote.meta.name;
      },
      nav: true,
      component: () => import('./routes/RemotePage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations: {},
  widgets: [
    {
      id: 'status',
      get title() {
        return t.remote.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RemoteWidget'),
    },
  ],
  settings,
  dataApi: false,
  defaultEnabled: false,
  maturity: 'preview',
  seed: { version: 1, dependsOn: [], none: 'live-data' },
  layout: 'full',
  order: 198,
  area: 'system',
  contributions: { onboarding: noOnboarding },
};

export default manifest;
