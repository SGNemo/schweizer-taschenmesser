import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { onboarding } from './onboarding';
import { categorySchema, documentSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'vault',
  get name() {
    return t.vault.meta.name;
  },
  icon: 'files',
  identity: {
    hue: 'indigo',
    hue2: 'violet',
    widget: 'kennzahl',
    head: 'standard',
    signature: 'folderTab',
    tabs: true,
  },
  version: 4,
  get description() {
    return t.vault.meta.description;
  },
  routes: [
    {
      path: '/vault',
      get label() {
        return t.vault.meta.route;
      },
      nav: true,
      component: () => import('./routes/VaultPage'),
    },
  ],
  dataSchema: {
    collections: {
      document: {
        schema: documentSchema,
        indexes: ['category', 'expiresOn'],
        // Since version 4 `category` is any id, so the import text no longer lists the built-in ones: the example
        // shows one. An unknown value is kept and shown under "Ohne Kategorie", never dropped.
        example: {
          title: 'Mobilfunkvertrag',
          category: 'contract',
          provider: 'Beispiel Mobil GmbH',
          endDate: '2027-06-30',
          noticeDays: 30,
        },
      },
      // The user's folders (since version 4); built-in ones get a record only once they are changed.
      // Not in the data API or the JSON import: folders are made here, not imported.
      category: { schema: categorySchema, indexes: [], dataApi: false },
    },
  },
  migrations,
  widgets: [
    {
      id: 'expiring',
      get title() {
        return t.vault.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/ExpiringWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  maturity: 'stable',
  seed: { version: 2, dependsOn: [] },
  layout: 'split',
  order: 150,
  area: 'vault',
  contributions: {
    attention: () => import('./attention'),
    onboarding,
    quickAdd: [
      {
        id: 'document',
        get label() {
          return t.vault.meta.quickAdd;
        },
        to: '/vault?new=1',
      },
    ],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    // Deadlines and expiry dates in the planner; titles are category wording only (`plannable.ts`).
    plannable: () => import('./plannable'),
    services: () => import('./services'),
  },
};

export default manifest;
