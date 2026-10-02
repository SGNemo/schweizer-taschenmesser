import { onboarding } from './onboarding';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { accountSchema, categorySchema, transactionSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'finance',
  name: t.finance.meta.name,
  icon: 'wallet',
  version: 1,
  description: t.finance.meta.description,
  routes: [
    {
      path: '/finance',
      label: t.finance.meta.route,
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
      title: t.finance.meta.widget,
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
    quickAdd: [
      { id: 'transaction', label: t.finance.meta.quickAdd, to: '/finance?tab=transactions&new=1' },
    ],
    services: () => import('./services'),
    aiCreateDefaults: () => import('./aiDefaults'),
    aiComputed: () => import('./aiComputed'),
  },
};

export default manifest;
