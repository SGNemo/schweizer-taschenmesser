import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { t } from '@/strings';
import { migrations } from './migrations';
import { itemSchema } from './schema';
import { settings } from './settings';

/**
 * Device exchange („Austausch“, concept `docs/design/device-exchange/CONCEPT.md`): notes and links
 * between the phone and the PC over the home-network pairing. The cards are device-local
 * (`local: true`): never synced, never in a backup, never searched – no `aiSchema`, no data API
 * (also blocked by id in `core/dataapi/scope.ts`), so nothing of it can reach the assistant. Who
 * may send to the PC is decided at the PC alone (its grant, confirmed by Windows).
 */
const manifest: ModuleManifest = {
  id: 'exchange',
  get name() {
    return t.exchange.meta.name;
  },
  icon: 'swap',
  identity: {
    hue: 'ocean',
    hue2: 'fern',
    widget: 'status',
    head: 'standard',
    signature: 'handoff',
  },
  version: 1,
  get description() {
    return t.exchange.meta.description;
  },
  platforms: ['desktop', 'android'],
  routes: [
    {
      path: '/exchange',
      get label() {
        return t.exchange.meta.name;
      },
      nav: true,
      component: () => import('./routes/ExchangePage'),
    },
  ],
  dataSchema: {
    collections: {
      item: { schema: itemSchema, indexes: ['createdAt'], local: true },
    },
  },
  migrations,
  widgets: [
    {
      id: 'status',
      get title() {
        return t.exchange.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/ExchangeWidget'),
    },
  ],
  settings,
  dataApi: false,
  defaultEnabled: false,
  maturity: 'preview',
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  order: 199,
  area: 'knowledge',
  contributions: {
    onboarding: noOnboarding,
    services: () => import('./services'),
  },
};

export default manifest;
