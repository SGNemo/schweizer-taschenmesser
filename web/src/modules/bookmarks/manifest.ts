import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { itemSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'bookmarks',
  get name() {
    return t.bookmarks.meta.name;
  },
  icon: 'bookmark',
  identity: {
    hue: 'indigo',
    hue2: 'cobalt',
    widgetType: 'tiles',
    widget: 'kacheln',
    head: 'regal',
    signature: 'pinboard',
  },
  version: 2,
  get description() {
    return t.bookmarks.meta.description;
  },
  routes: [
    {
      path: '/bookmarks',
      get label() {
        return t.bookmarks.meta.route;
      },
      nav: true,
      component: () => import('./routes/BookmarksPage'),
    },
    {
      path: '/bookmarks/read/:id',
      get label() {
        return t.bookmarks.reader.mode;
      },
      layout: 'content',
      component: () => import('./routes/ReaderPage'),
    },
  ],
  dataSchema: {
    collections: {
      item: { schema: itemSchema, indexes: ['done', 'kind', '*tags'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'recent',
      get title() {
        return t.bookmarks.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RecentWidget'),
    },
    {
      id: 'links',
      get title() {
        return t.bookmarks.meta.widgetLinks;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/LinksWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 3, dependsOn: [] },
  layout: 'wide',
  order: 70,
  area: 'knowledge',
  contributions: {
    onboarding: onboarding,
    quickAdd: [
      {
        id: 'item',
        get label() {
          return t.bookmarks.meta.quickAdd;
        },
        to: '/bookmarks?new=1',
      },
    ],
    services: () => import('./services'),
  },
};

export default manifest;
