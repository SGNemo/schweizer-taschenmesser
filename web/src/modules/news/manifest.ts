import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { articleSchema, feedSchema, feedStateSchema } from './schema';
import { settings } from './settings';

// No `aiSchema` on purpose: articles are public third-party text and change all the time; the
// assistant neither queries nor creates them. The optional "Tagesüberblick" is a separate, explicit
// button that sends only headline titles (core/ai/newsBrief.ts).
const manifest: ModuleManifest = {
  id: 'news',
  name: 'Nachrichten',
  icon: 'note',
  version: 1,
  description:
    'Schlagzeilen aus RSS-/Atom-Feeds nach Themen, ungelesen/gelesen, mit Suche, „Für später“ in der Merkliste und einem optionalen KI-Tagesüberblick auf Knopfdruck.',
  routes: [
    {
      path: '/news',
      label: 'Nachrichten',
      nav: true,
      component: () => import('./routes/NewsPage'),
    },
  ],
  dataSchema: {
    collections: {
      feed: { schema: feedSchema, indexes: ['category'] },
      // Fetched articles and fetch bookkeeping stay on the device (see `CollectionDef.local`).
      article: { schema: articleSchema, indexes: ['feedId', 'publishedAt'], local: true },
      feedstate: { schema: feedStateSchema, indexes: [], local: true },
    },
  },
  migrations,
  widgets: [
    {
      id: 'headlines',
      title: 'Schlagzeilen',
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/HeadlinesWidget'),
    },
  ],
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 95,
  contributions: {
    onboarding,
    services: () => import('./services'),
  },
};

export default manifest;
