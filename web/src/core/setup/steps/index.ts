import { t } from '@/strings';
import type { SetupStepDef } from '../types';

const s = t.setup.steps;

/**
 * Steps owned by the core. The components live in `layout/setup/steps` (they reuse the settings
 * sections) and are loaded lazily. Orders: basics 10 … dashboard 120; the security/AI/account
 * steps of later phases slot in between.
 */
export const CORE_STEPS: SetupStepDef[] = [
  {
    id: 'core.basics',
    title: s.basics.title,
    description: s.basics.description,
    order: 10,
    since: 1,
    component: () => import('@/layout/setup/steps/BasicsStep'),
  },
  {
    id: 'core.sync',
    title: s.sync.title,
    description: s.sync.description,
    order: 20,
    since: 1,
    isDone: async () => {
      const { db } = await import('@/core/db/db');
      return !!(await db.table('_secrets').get('syncConfig'));
    },
    component: () => import('@/layout/setup/steps/SyncStep'),
  },
  {
    id: 'core.profiles',
    title: s.profiles.title,
    description: s.profiles.description,
    order: 30,
    since: 1,
    component: () => import('@/layout/setup/steps/ProfilesStep'),
  },
  {
    id: 'core.tools',
    title: s.tools.title,
    description: s.tools.description,
    order: 40,
    since: 1,
    component: () => import('@/layout/setup/steps/ToolsStep'),
  },
  {
    id: 'core.dashboard',
    title: s.dashboard.title,
    description: s.dashboard.description,
    order: 120,
    since: 1,
    when: (ctx) => Object.values(ctx.modules).some(Boolean),
    component: () => import('@/layout/setup/steps/DashboardStep'),
  },
];
