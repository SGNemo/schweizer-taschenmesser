import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';
import { PACKING_TEMPLATES } from './logic';

const s = t.onboarding.lists;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'text',
      kind: 'text',
      label: s.text,
      description: s.textHint,
      placeholder: s.placeholder,
    },
    {
      id: 'templates',
      kind: 'template',
      label: s.templates,
      description: s.templatesHint,
      templates: PACKING_TEMPLATES.map((id) => ({
        id,
        label: s[id].name,
        detail: `${s.packingKind}, ${s[id].items.length}`,
      })),
    },
  ],
  load: () => import('./importer'),
};
