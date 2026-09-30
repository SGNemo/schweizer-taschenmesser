import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { settings } from './settings';

/**
 * Live facts about this computer (desktop only). Holds no data: nothing is stored, synced, backed
 * up or shown to the assistant, so it has no collections, no `aiSchema`, no widget and
 * `dataApi: false` (also blocked by id in `core/dataapi/scope.ts`).
 */
const manifest: ModuleManifest = {
  id: 'system',
  name: 'Systeminfo',
  icon: 'cpu',
  version: 1,
  description:
    'Prozessor, Arbeitsspeicher, Akku, Grafik, Netzwerkadressen und die Programme mit dem größten Speicherverbrauch – nur zum Ansehen, nur am PC.',
  platforms: ['desktop'],
  routes: [
    {
      path: '/system',
      label: 'Systeminfo',
      nav: true,
      component: () => import('./routes/SystemPage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations,
  widgets: [],
  settings,
  dataApi: false,
  defaultEnabled: false,
  layout: 'content',
  order: 195,
  contributions: { onboarding: noOnboarding },
};

export default manifest;
