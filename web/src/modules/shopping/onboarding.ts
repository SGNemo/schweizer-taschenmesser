import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.shopping;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'text',
      kind: 'text',
      label: s.text,
      description: s.textHint,
      placeholder: s.placeholder,
    },
  ],
  load: () => import('./importer'),
};
