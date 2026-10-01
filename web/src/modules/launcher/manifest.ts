import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { linkSchema } from './schema';
import { settings } from './settings';

/**
 * No `aiSchema` on purpose: the assistant has no use for a list of bookmarks-with-a-button, and
 * every module in the schema text costs tokens on every question.
 */
const manifest: ModuleManifest = {
  id: 'launcher',
  name: 'Apps & Links',
  icon: 'external',
  version: 1,
  description:
    'Kacheln für Dienste, die du oft brauchst: Paketverfolgung, Bahn, Karten, Musik. Ein Tipp öffnet die Seite im Browser oder in der passenden App.',
  routes: [
    {
      path: '/launcher',
      label: 'Apps & Links',
      nav: true,
      component: () => import('./routes/LauncherPage'),
    },
  ],
  dataSchema: {
    collections: {
      link: {
        schema: linkSchema,
        indexes: ['group'],
        example: { title: 'Beispielseite', url: 'https://example.org' },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'links',
      title: 'Apps & Links',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/LinksWidget'),
    },
  ],
  settings,
  defaultEnabled: false,
  layout: 'wide',
  order: 170,
  contributions: {
    onboarding,
    quickAdd: [{ id: 'link', label: 'Link hinzufügen', to: '/launcher?new=1' }],
  },
};

export default manifest;
