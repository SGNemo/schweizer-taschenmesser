import { noOnboarding } from '@/core/importer/types';
import { ALL_WIDGET_SIZES, type ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { budgetSchema, depositSchema, goalSchema } from './schema';
import { settings } from './settings';
import { t } from '@/strings';

const manifest: ModuleManifest = {
  id: 'budgets',
  requires: ['finance'],
  name: t.budgets.meta.name,
  icon: 'piggy',
  version: 1,
  description: t.budgets.meta.description,
  routes: [
    {
      path: '/budgets',
      label: t.budgets.meta.route,
      nav: true,
      component: () => import('./routes/BudgetsPage'),
    },
  ],
  dataSchema: {
    collections: {
      budget: { schema: budgetSchema, indexes: ['categoryId'] },
      goal: { schema: goalSchema, indexes: ['deadline'] },
      deposit: { schema: depositSchema, indexes: ['goalId', 'date'] },
    },
  },
  migrations,
  widgets: [
    {
      id: 'overview',
      title: t.budgets.meta.widget,
      defaultSize: 'm',
      sizes: ALL_WIDGET_SIZES,
      component: () => import('./widgets/OverviewWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  seed: { version: 1, dependsOn: ['finance'] },
  layout: 'wide',
  order: 130,
  area: 'money',
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'goal', label: t.budgets.meta.quickAdd, to: '/budgets?tab=goals&new=1' }],
  },
};

export default manifest;
