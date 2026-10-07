import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.birthdays;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'text',
      kind: 'text',
      get label() {
        return s.text;
      },
      get description() {
        return s.textHint;
      },
      get placeholder() {
        return s.placeholder;
      },
    },
  ],
  load: () => import('./importer'),
};
