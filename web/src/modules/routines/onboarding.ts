import type { OnboardingDef } from '@/core/importer/types';
import { describeRecurrence } from '@/core/recurrence/describe';
import { t } from '@/strings';
import { ROUTINE_TEMPLATES, ROUTINE_TEMPLATE_IDS } from './templates';

/** Start data: typical routines to tick. None is pre-ticked: the household decides what it keeps. */
export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'templates',
      kind: 'template',
      get label() {
        return t.onboarding.routines.label;
      },
      get description() {
        return t.onboarding.routines.hint;
      },
      templates: ROUTINE_TEMPLATE_IDS.map((id) => ({
        id,
        // Read when shown, so they follow a language switch.
        get label() {
          return t.onboarding.routines.items[id].name;
        },
        get detail() {
          const room = t.onboarding.routines.items[id].room;
          const rhythm = describeRecurrence(ROUTINE_TEMPLATES[id].repeat);
          return room ? `${room} · ${rhythm}` : rhythm;
        },
      })),
    },
  ],
  load: () => import('./importer'),
};
