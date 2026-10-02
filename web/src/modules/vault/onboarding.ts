import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      label: t.onboarding.mail.contracts,
      description: t.onboarding.mail.hint,
    },
  ],
  load: () => import('./importer'),
};
