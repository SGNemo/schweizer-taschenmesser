import { z } from 'zod';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';

/**
 * Disk overview and cleaner (desktop only). Holds no data of its own: scan results live in memory
 * (Rust side) for the session and are never synced, stored, backed up or offered to the assistant –
 * hence no collections, no `aiSchema`, a single widget that only shows drive fill levels, and `dataApi: false` (also blocked by id in
 * `core/dataapi/scope.ts`).
 */
const manifest: ModuleManifest = {
  id: 'disk',
  name: 'Datenträger',
  icon: 'disk',
  version: 1,
  description:
    'Zeigt deine Laufwerke und findet mit einem Scan die größten Ordner – grafisch als Kartenansicht. Nur am PC; der Scan verändert nichts.',
  platforms: ['desktop'],
  routes: [
    {
      path: '/disk',
      label: 'Datenträger',
      nav: true,
      component: () => import('./routes/DrivesPage'),
    },
    {
      path: '/disk/scan',
      label: 'Datenträger-Scan',
      component: () => import('./routes/ScanPage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations: {},
  widgets: [
    {
      id: 'status',
      title: 'Laufwerke',
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/DrivesWidget'),
    },
  ],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  dataApi: false,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [], none: 'live-data' },
  layout: 'full',
  order: 190,
  area: 'system',
  contributions: { onboarding: noOnboarding },
};

export default manifest;
