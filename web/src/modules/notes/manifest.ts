import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { noteSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'notes',
  get name() {
    return t.notes.meta.name;
  },
  icon: 'note',
  version: 1,
  get description() {
    return t.notes.meta.description;
  },
  routes: [
    {
      path: '/notes',
      get label() {
        return t.notes.meta.route;
      },
      nav: true,
      component: () => import('./routes/NotesPage'),
    },
  ],
  dataSchema: {
    collections: {
      note: {
        schema: noteSchema,
        indexes: ['pinned'],
        example: { title: 'Geschenkideen', body: 'Buch, Kerze, Tee' },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'recent',
      get title() {
        return t.notes.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RecentNotesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 2, dependsOn: [] },
  layout: 'wide',
  order: 80,
  area: 'knowledge',
  contributions: {
    onboarding: noOnboarding,
    services: () => import('./services'),
    quickAdd: [
      {
        id: 'note',
        get label() {
          return t.notes.meta.quickAdd;
        },
        to: '/notes?new=1',
      },
    ],
  },
};

export default manifest;
