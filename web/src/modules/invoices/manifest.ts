import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { invoiceSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'invoices',
  requires: ['finance'],
  name: t.invoices.meta.name,
  icon: 'receipt',
  version: 1,
  description: t.invoices.meta.description,
  routes: [
    {
      path: '/invoices',
      label: t.invoices.meta.route,
      nav: true,
      component: () => import('./routes/InvoicesPage'),
    },
  ],
  dataSchema: {
    collections: {
      invoice: { schema: invoiceSchema, indexes: ['dueDate', 'status'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'due',
      title: t.invoices.meta.widget,
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/DueInvoicesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: ['finance'] },
  layout: 'wide',
  order: 50,
  area: 'money',
  contributions: {
    attention: () => import('./attention'),
    onboarding: onboarding,
    quickAdd: [{ id: 'invoice', label: t.invoices.meta.quickAdd, to: '/invoices?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    aiComputed: () => import('./aiComputed'),
  },
};

export default manifest;
