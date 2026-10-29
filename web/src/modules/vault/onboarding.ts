import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';
import { PAPER_TEMPLATES } from './logic';

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'papers',
      kind: 'template',
      get label() {
        return t.onboarding.papers.label;
      },
      get description() {
        return t.onboarding.papers.hint;
      },
      templates: PAPER_TEMPLATES.map((id) => ({
        id,
        get label() {
          return t.onboarding.papers.items[id].name;
        },
        get detail() {
          return t.onboarding.papers.kind;
        },
      })),
    },
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
