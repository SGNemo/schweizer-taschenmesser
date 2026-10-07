import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      get label() {
        return t.onboarding.mail.contracts;
      },
      get description() {
        return t.onboarding.mail.hint;
      },
    },
  ],
  load: () => import('./importer'),
};
