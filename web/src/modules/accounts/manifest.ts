import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { entrySchema, vaultSchema } from './schema';
import { settings } from './settings';

/**
 * Password vault. **No `aiSchema`, no widgets, no calendar/notification contributions, no quick-add:**
 * the module must not exist for the assistant, the dashboard or any other module (enforced by
 * `__tests__/exclusion.test.ts`). Everything it stores is ciphertext.
 */
const manifest: ModuleManifest = {
  id: 'accounts',
  name: 'Accounts',
  icon: 'lock',
  version: 1,
  dataApi: false,
  description:
    'Passwort-Tresor: Zugangsdaten mit Master-Passwort verschlüsselt (Argon2id, AES-256), Generator, Einmalcodes (TOTP), Import/Export. Komplett von der KI ausgeschlossen.',
  routes: [
    {
      path: '/accounts',
      label: 'Accounts',
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
  widgets: [],
  settings,
  defaultEnabled: false,
  layout: 'wide',
  order: 160,
  contributions: { onboarding: noOnboarding, services: () => import('./service') },
};

export default manifest;
