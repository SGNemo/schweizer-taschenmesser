import { t } from '@/strings';
import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { migrations } from './migrations';
import { bodySchema, threadSchema } from './schema';
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
  version: 1,
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
      id: 'unread',
      get title() {
        return t.mail.widget.unread;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/UnreadWidget'),
      to: '/mail',
    },
    {
      id: 'top',
      get title() {
        return t.mail.widget.important;
      },
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/TopWidget'),
      to: '/mail',
    },
    {
      id: 'invoices',
      get title() {
        return t.mail.widget.invoices;
      },
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/InvoicesWidget'),
      to: '/mail?q=rechnung',
    },
  ],
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: [] },
  layout: 'content',
  area: 'knowledge',
  contributions: {
    onboarding: noOnboarding,
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
