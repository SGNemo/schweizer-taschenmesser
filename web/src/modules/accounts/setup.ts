import type { SetupStepDef } from '@/core/setup/types';
import { t } from '@/strings';

/** The assistant's security step: master password, biometrics, auto-lock. Carries no data. */
export const setupSteps: SetupStepDef[] = [
  {
    id: 'accounts.vault',
    get title() {
      return t.accounts.setupStep.title;
    },
    get description() {
      return t.accounts.setupStep.description;
    },
    order: 50,
    since: 1,
    when: (ctx) => ctx.modules.accounts === true,
    // Lazy: the manifest is loaded at startup, the crypto code is not.
    isDone: async () => (await (await import('./vault')).readHeader()).state === 'ready',
    component: () => import('./components/VaultSetupStep'),
  },
];
