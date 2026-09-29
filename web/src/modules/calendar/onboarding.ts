import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'ics',
      kind: 'file',
      label: t.onboarding.calendar.ics,
      description: t.onboarding.calendar.icsHint,
      accept: '.ics,text/calendar',
    },
  ],
  load: () => import('./importer'),
};
