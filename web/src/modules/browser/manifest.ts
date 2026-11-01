import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { blockruleSchema, bookmarkSchema, historySchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'browser',
  get name() {
    return t.browser.meta.name;
  },
  icon: 'globe',
  version: 1,
  get description() {
    return t.browser.meta.description;
  },
  platforms: ['desktop'],
  routes: [
    {
      path: '/browser',
      get label() {
        return t.browser.meta.name;
      },
      nav: true,
      component: () => import('./routes/BrowserPage'),
    },
  ],
  dataSchema: {
    collections: {
      bookmark: { schema: bookmarkSchema, indexes: ['createdAt'], local: true },
      history: { schema: historySchema, indexes: ['createdAt'], local: true },
      blockrule: { schema: blockruleSchema, indexes: ['createdAt'], local: true },
    },
  },
  migrations,
  widgets: [
    {
      id: 'bookmarks',
      get title() {
        return t.browser.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/BookmarksWidget'),
    },
  ],
  // Private by nature (what you read): no aiSchema, no data API, no search index.
  dataApi: false,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'full',
  area: 'knowledge', // navigation area: plan | money | household | knowledge | vault | system
  // order: 50, // lower = earlier in navigation and library (default 100)
  contributions: {
    // Start-data importers (see modules/todos/importer.ts); `noOnboarding` = nothing to import.
    onboarding: noOnboarding,
  },
};

export default manifest;
