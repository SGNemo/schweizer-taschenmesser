import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

/** Package 3: training (Strong, Hevy) and food (Cronometer) from another app's CSV export. */
export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'file',
      kind: 'file',
      get label() {
        return t.onboarding.fitness.file;
      },
      get description() {
        return t.onboarding.fitness.fileHint;
      },
      accept: '.csv,text/csv',
      multiple: true,
    },
  ],
  load: () => import('./importer'),
};
