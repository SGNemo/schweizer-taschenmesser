import { z } from 'zod';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';

/**
 * "Gerätestatus" (UI audit 2026-11, module package S-b): one page that says how this device is doing – backup, sync,
 * storage, updates – on every platform, so the area System exists on the phone too. It holds no data of its own and
 * switches nothing: every line is read live from the core (`core/status`, the same lines the settings show) or from
 * the platform, and leads to the settings where the thing is set. Hence no collections, no `aiSchema`, no search,
 * `dataApi: false` (also blocked by id in `core/dataapi/scope.ts`), no seed data, and never a server address, a
 * token, a key, a path or an IP on the page or the widget.
 */
const manifest: ModuleManifest = {
  id: 'device',
  get name() {
    return t.device.meta.name;
  },
  icon: 'activity',
  identity: {
    hue: 'moss',
    widget: 'status',
    head: 'standard',
    signature: 'dial',
  },
  version: 1,
  get description() {
    return t.device.meta.description;
  },
  routes: [
    {
      // The same path as `DEVICE_STATUS_PATH` in core/status/summary.ts (pinned by the exclusion test); written out
      // here so the manifest, which loads at the start, pulls in nothing of the status code.
      path: '/device',
      get label() {
        return t.device.meta.name;
      },
      nav: true,
      component: () => import('./routes/StatusPage'),
    },
  ],
  dataSchema: { collections: {} },
  migrations: {},
  widgets: [
    {
      id: 'status',
      get title() {
        return t.device.meta.name;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/DeviceWidget'),
    },
  ],
  settings: { schema: z.object({}), defaults: {}, fields: [] },
  dataApi: false,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 1, dependsOn: [], none: 'live-data' },
  layout: 'reading',
  order: 180,
  area: 'system',
  contributions: { onboarding: noOnboarding },
};

export default manifest;
