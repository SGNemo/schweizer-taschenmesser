import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';
import { PACKING_TEMPLATES } from './logic';

const s = t.onboarding.lists;

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
    {
      id: 'templates',
      kind: 'template',
      get label() {
        return s.templates;
      },
      get description() {
        return s.templatesHint;
      },
      templates: PACKING_TEMPLATES.map((id) => ({
        id,
        get label() {
          return s[id].name;
        },
        get detail() {
          return t.lists.templateDetail(s.packingKind, s[id].items.length);
        },
      })),
    },
  ],
  load: () => import('./importer'),
};
