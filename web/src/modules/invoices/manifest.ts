import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { invoiceSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'invoices',
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
      size: 's',
      component: () => import('./widgets/DueInvoicesWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  order: 50,
  contributions: {
    quickAdd: [{ id: 'invoice', label: 'Rechnung', to: '/invoices?new=1' }],
    calendarItems: () => import('./calendar'),
    notifications: () => import('./notifications'),
  },
};

export default manifest;
