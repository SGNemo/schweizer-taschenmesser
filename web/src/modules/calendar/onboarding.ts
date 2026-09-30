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
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      label: t.onboarding.mail.calendar,
      description: t.onboarding.mail.hint,
    },
  ],
  load: () => import('./importer'),
};
