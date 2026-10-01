import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { invoiceSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'invoices',
  requires: ['finance'],
  name: 'Rechnungen',
  icon: 'receipt',
  version: 1,
  description:
    'Offene Rechnungen mit Betrag, Empfänger und Fälligkeit. „Als bezahlt markieren“ bucht die Ausgabe automatisch in Finanzen.',
  routes: [
    {
      path: '/invoices',
      label: 'Rechnungen',
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
      title: 'Fällige Rechnungen',
      defaultSize: 's',
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
  contributions: {
    onboarding: onboarding,
    quickAdd: [{ id: 'invoice', label: 'Rechnung', to: '/invoices?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
    aiComputed: () => import('./aiComputed'),
  },
};

export default manifest;
