import { isAiConfigured, loadAiConfig } from '@/core/ai/config';
import { isAiOn } from '@/core/ai/switch';
import { connectors } from '@/core/connectors/registry';
import { loadStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
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
    get title() {
      return s.basics.title;
    },
    get description() {
      return s.basics.description;
    },
    order: 10,
    since: 1,
    component: () => import('@/layout/setup/steps/BasicsStep'),
  },
  {
    id: 'core.sync',
    get title() {
      return s.sync.title;
    },
    get description() {
      return s.sync.description;
    },
    order: 20,
    since: 1,
    isDone: async () => {
      return !!(await db.table('_secrets').get('syncConfig'));
    },
    component: () => import('@/layout/setup/steps/SyncStep'),
  },
  {
    id: 'core.profiles',
    get title() {
      return s.profiles.title;
    },
    get description() {
      return s.profiles.description;
    },
    order: 30,
    since: 1,
    component: () => import('@/layout/setup/steps/ProfilesStep'),
  },
  {
    id: 'core.tools',
    get title() {
      return s.tools.title;
    },
    get description() {
      return s.tools.description;
    },
    order: 40,
    since: 1,
    component: () => import('@/layout/setup/steps/ToolsStep'),
  },
  {
    id: 'core.ai',
    get title() {
      return s.ai.title;
    },
    get description() {
      return s.ai.description;
    },
    order: 60,
    since: 1,
    when: () => isAiOn(),
    isDone: async () => {
      return isAiConfigured(await loadAiConfig());
    },
    component: () => import('@/layout/setup/steps/AiStep'),
  },
  {
    id: 'core.connectors',
    get title() {
      return s.connectors.title;
    },
    get description() {
      return s.connectors.description;
    },
    order: 70,
    since: 1,
    when: () => connectors.length > 0,
    isDone: async () => {
      for (const c of connectors) if ((await loadStatus(c.id)).state === 'connected') return true;
      return false;
    },
    component: () => import('@/layout/setup/steps/ConnectorsStep'),
  },
  {
    id: 'core.startdata',
    get title() {
      return s.startdata.title;
    },
    get description() {
      return s.startdata.description;
    },
    order: 80,
    since: 1,
    when: async (ctx) => {
      const { availableManifests } = await import('@/core/modules/available');
      const { hasStartData } = await import('@/core/dataapi/onboarding');
      return availableManifests().some((m) => ctx.modules[m.id] && hasStartData(m));
    },
    component: () => import('@/layout/setup/steps/StartDataStep'),
  },
  {
    id: 'core.aiimport',
    get title() {
      return s.aiimport.title;
    },
    get description() {
      return s.aiimport.description;
    },
    order: 90,
    since: 1,
    when: async (ctx) => {
      if (!(await isAiOn())) return false;
      const { aiImportModules } = await import('@/layout/setup/steps/AiImportStep');
      return aiImportModules(ctx.modules).length > 0;
    },
    component: () => import('@/layout/setup/steps/AiImportStep'),
  },
  {
    id: 'core.notifications',
    get title() {
      return s.notifications.title;
    },
    get description() {
      return s.notifications.description;
    },
    order: 100,
    since: 1,
    isDone: async () => getPlatform().notifications.permission() === 'granted',
    component: () => import('@/layout/setup/steps/NotificationsStep'),
  },
  {
    id: 'core.backupupdates',
    get title() {
      return s.backupupdates.title;
    },
    get description() {
      return s.backupupdates.description;
    },
    order: 110,
    since: 1,
    component: () => import('@/layout/setup/steps/BackupUpdatesStep'),
  },
  {
    id: 'core.support',
    get title() {
      return s.support.title;
    },
    get description() {
      return s.support.description;
    },
    order: 130,
    since: 1, // no SETUP_VERSION bump: an installation that finished the assistant is not nagged
    when: async () => {
      const { getSettings } = await import('@/core/settings/settings');
      const { supporterSettingsSchema, SUPPORTER_SCOPE, DEFAULT_SUPPORTER } =
        await import('@/core/supporter/settings');
      return !(await getSettings(SUPPORTER_SCOPE, supporterSettingsSchema, DEFAULT_SUPPORTER))
        .hideSetupHint;
    },
    hint: true, // never counted or listed in the dashboard checklist
    component: () => import('@/layout/setup/steps/SupporterStep'),
  },
  {
    id: 'core.dashboard',
    get title() {
      return s.dashboard.title;
    },
    get description() {
      return s.dashboard.description;
    },
    order: 120,
    since: 1,
    when: (ctx) => Object.values(ctx.modules).some(Boolean),
    component: () => import('@/layout/setup/steps/DashboardStep'),
  },
];
