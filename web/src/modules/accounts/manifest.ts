import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { entrySchema, vaultSchema } from './schema';
import { settings } from './settings';
import { setupSteps } from './setup';
import { t } from '@/strings';

/**
 * Password vault. **No `aiSchema`, no calendar/notification contributions, no quick-add, and only one
 * status widget (locked/unlocked + link, never entries):** the module must not exist for the
 * assistant or any other module (enforced by
 * `__tests__/exclusion.test.ts`). Everything it stores is ciphertext.
 */
const manifest: ModuleManifest = {
  id: 'accounts',
  get name() {
    return t.accounts.meta.name;
  },
  icon: 'lock',
  version: 1,
  dataApi: false,
  get description() {
    return t.accounts.meta.description;
  },
  routes: [
    {
      path: '/accounts',
      get label() {
        return t.accounts.meta.route;
      },
      nav: true,
      component: () => import('./routes/AccountsPage'),
    },
  ],
  dataSchema: {
    collections: {
      vault: { schema: vaultSchema, indexes: [] },
      entry: { schema: entrySchema, indexes: [] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'status',
      get title() {
        return t.accounts.meta.widget;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/StatusWidget'),
    },
  ],
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 160,
  area: 'vault',
  setupSteps,
  contributions: { onboarding: noOnboarding, services: () => import('./service') },
};

export default manifest;
