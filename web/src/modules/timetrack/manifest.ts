import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { entrySchema, projectSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'timetrack',
  name: 'Zeiterfassung',
  icon: 'clock',
  version: 1,
  description:
    'Arbeitszeit je Projekt mit Timer oder zum Nachtragen, Wochenübersicht und Stundenzettel als CSV zum Speichern.',
  routes: [
    {
      path: '/timetrack',
      label: 'Zeiterfassung',
      nav: true,
      component: () => import('./routes/TimetrackPage'),
    },
  ],
  dataSchema: {
    collections: {
      project: {
        schema: projectSchema,
        indexes: ['archived'],
        example: { name: 'Beispielprojekt' },
      },
      entry: {
        schema: entrySchema,
        indexes: ['date', 'projectId'],
        example: { projectId: 'Beispielprojekt', date: '2026-01-05', minutes: 90 },
      },
    },
  },
  migrations,
  widgets: [
    {
      id: 'today',
      title: 'Zeiterfassung',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/TodayWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  order: 105,
  area: 'plan',
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'entry', label: 'Zeit erfassen', to: '/timetrack?new=1' }],
  },
};

export default manifest;
