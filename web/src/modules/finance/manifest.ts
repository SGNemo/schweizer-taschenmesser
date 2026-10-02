import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
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
      defaultSize: 's',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/BalanceWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: true,
  seed: { version: 1, dependsOn: [] },
  layout: 'wide',
  order: 40,
  area: 'money',
  contributions: {
    onboarding: onboarding,
    quickAdd: [{ id: 'transaction', label: 'Buchung', to: '/finance?tab=transactions&new=1' }],
    services: () => import('./services'),
    aiCreateDefaults: () => import('./aiDefaults'),
    aiComputed: () => import('./aiComputed'),
  },
};

export default manifest;
