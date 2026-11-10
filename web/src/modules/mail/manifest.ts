import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { bodySchema, linkSchema, threadSchema } from './schema';
import { settings } from './settings';

/**
 * Mail (Gmail, read-only). No `aiSchema`, nothing searchable, no data API: mail content never reaches an
 * assistant or another app (pinned by `core/mail/isolation.test.ts`). Both collections are device-local
 * caches, sealed with the device key (`cache.ts`).
 */
const manifest: ModuleManifest = {
  id: 'mail',
  get name() {
    return t.mail.meta.name;
  },
  icon: 'mail',
  identity: {
    hue: 'teal',
    hue2: 'ocean',
    widget: 'notiz',
    head: 'schreib',
    signature: 'stamp',
  },
  version: 3,
  get description() {
    return t.mail.meta.description;
  },
  routes: [
    {
      path: '/mail',
      get label() {
        return t.mail.meta.name;
      },
      nav: true,
      component: () => import('./routes/MailPage'),
    },
  ],
  dataSchema: {
    collections: {
      thread: {
        schema: threadSchema,
        indexes: ['accountKey', 'sortKey'],
        local: true,
        dataApi: false,
      },
      link: {
        schema: linkSchema,
        indexes: ['accountKey', 'threadId'],
        local: true,
        dataApi: false,
      },
      body: {
        schema: bodySchema,
        indexes: ['accountKey', 'threadId', 'sortKey'],
        local: true,
        dataApi: false,
      },
    },
  },
  migrations,
  dataApi: false,
  platforms: ['desktop'],
  widgets: [
    {
      id: 'inbox',
      get title() {
        return t.mail.widget.inbox;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/InboxWidget'),
      to: '/mail',
    },
  ],
  settings,
  // Only tested against a mocked Gmail API so far; a real-account check is open (MANUAL-TESTS "E-Mail lesen").
  maturity: 'preview',
  defaultEnabled: false,
  seed: { version: 3, dependsOn: [] },
  layout: 'full',
  area: 'knowledge',
  automation: () => import('./automation'),
  contributions: {
    onboarding: noOnboarding,
    // New-mail notifications: off until switched on in the module settings.
    services: () => import('./notifyService'),
    notifications: () => import('./notifications'),
    quickAdd: [
      {
        id: 'open',
        get label() {
          return t.mail.meta.quickAdd;
        },
        to: '/mail',
      },
    ],
  },
};

export default manifest;
