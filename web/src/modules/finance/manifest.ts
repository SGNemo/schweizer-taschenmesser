import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { accountSchema, categorySchema, transactionSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'finance',
  name: 'Finanzen',
  icon: 'wallet',
  version: 1,
  description:
    'Konten, Einnahmen und Ausgaben mit Kategorien, Monatsübersicht mit Diagrammen und dem wirklich verfügbaren Geld (nach offenen Rechnungen und Abos).',
  routes: [
    {
      path: '/finance',
      label: 'Finanzen',
      nav: true,
      component: () => import('./routes/FinancePage'),
    },
  ],
  dataSchema: {
    collections: {
      account: { schema: accountSchema, indexes: ['order'] },
      category: { schema: categorySchema, indexes: ['kind'] },
      transaction: { schema: transactionSchema, indexes: ['accountId', 'date', 'categoryId'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'balance',
      title: 'Kontostand',
      size: 's',
      component: () => import('./widgets/BalanceWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  order: 40,
  contributions: {
    quickAdd: [{ id: 'transaction', label: 'Buchung', to: '/finance?tab=transactions&new=1' }],
    services: () => import('./services'),
  },
};

export default manifest;
