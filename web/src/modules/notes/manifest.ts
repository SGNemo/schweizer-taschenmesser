import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { noteSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'notes',
  name: 'Notizen',
  icon: 'note',
  version: 1,
  description: 'Schnelle Notizen mit Titel und Text, wichtige Notizen oben anheften, mit Suche.',
  routes: [
    { path: '/notes', label: 'Notizen', nav: true, component: () => import('./routes/NotesPage') },
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
      title: 'Notizen',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/RecentNotesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 80,
  area: 'knowledge',
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'note', label: 'Notiz', to: '/notes?new=1' }],
  },
};

export default manifest;
