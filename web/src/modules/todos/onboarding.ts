import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'text',
      kind: 'text',
      label: t.onboarding.todos.text,
      description: t.onboarding.todos.textHint,
      placeholder: t.onboarding.todos.placeholder,
      options: [
        { key: 'listId', label: t.onboarding.todos.list, type: 'select', dynamicChoices: true },
      ],
    },
  ],
  load: () => import('./importer'),
};
