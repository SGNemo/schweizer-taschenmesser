import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
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
  dataSchema: { collections: { note: { schema: noteSchema, indexes: ['pinned'] } } },
  migrations,
  widgets: [
    {
      id: 'recent',
      title: 'Notizen',
      size: 's',
      component: () => import('./widgets/RecentNotesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'wide',
  order: 80,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'note', label: 'Notiz', to: '/notes?new=1' }],
  },
};

export default manifest;
