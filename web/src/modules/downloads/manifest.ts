import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { settings } from './settings';

/**
 * Download manager (desktop only). The jobs live in the Rust side (persisted there, resumed after a
 * restart), so the module has no collections, no `aiSchema` and `dataApi: false`: what you download
 * is nobody else's business. Nothing starts without a click and nothing downloaded is ever opened.
 */
const manifest: ModuleManifest = {
  id: 'downloads',
  get name() {
    return t.downloads.meta.name;
  },
  icon: 'download',
  version: 1,
  get description() {
    return t.downloads.meta.description;
  },
  platforms: ['desktop'],
  routes: [
    {
      path: '/downloads',
      get label() {
        return t.downloads.meta.name;
      },
      nav: true,
      component: () => import('./routes/DownloadsPage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations: {},
  widgets: [
    {
      id: 'running',
      get title() {
        return t.downloads.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RunningWidget'),
    },
  ],
  settings,
  dataApi: false,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'live-data' },
  layout: 'content',
  order: 195,
  area: 'system',
  contributions: { onboarding: noOnboarding },
};

export default manifest;
