import { z } from 'zod';
import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';

/**
 * Disk overview and cleaner (desktop only). Holds no data of its own: scan results live in memory
 * (Rust side) for the session and are never synced, stored, backed up or offered to the assistant –
 * hence no collections, no `aiSchema`, no widget, and `dataApi: false` (also blocked by id in
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
  widgets: [],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  dataApi: false,
  defaultEnabled: false,
  layout: 'full',
  order: 190,
  contributions: { onboarding: noOnboarding },
};

export default manifest;
