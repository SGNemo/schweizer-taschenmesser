import { noOnboarding } from '@/core/importer/types';
import type { ModuleManifest } from '@/core/modules/types';
import { aiSchema } from './ai';
import { migrations } from './migrations';
import { budgetSchema, depositSchema, goalSchema } from './schema';
import { settings } from './settings';

const manifest: ModuleManifest = {
  id: 'budgets',
  requires: ['finance'],
  name: 'Budgets & Sparziele',
  icon: 'piggy',
  version: 1,
  description:
    'Monatslimits je Ausgabenkategorie (aus den Finanzen) und Sparziele mit Einzahlungen und Fortschritt.',
  routes: [
    {
      path: '/budgets',
      label: 'Budgets',
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
      title: 'Budgets & Sparziele',
      size: 'm',
      component: () => import('./widgets/OverviewWidget'),
    },
  ],
  aiSchema,
  settings,
  defaultEnabled: false,
  layout: 'wide',
  order: 130,
  contributions: {
    onboarding: noOnboarding,
    quickAdd: [{ id: 'goal', label: 'Sparziel', to: '/budgets?tab=goals&new=1' }],
  },
};

export default manifest;
