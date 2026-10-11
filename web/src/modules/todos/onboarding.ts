import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'text',
      kind: 'text',
      get label() {
        return t.onboarding.todos.text;
      },
      get description() {
        return t.onboarding.todos.textHint;
      },
      get placeholder() {
        return t.onboarding.todos.placeholder;
      },
      options: [
        {
          key: 'listId',
          get label() {
            return t.onboarding.todos.list;
          },
          type: 'select',
          dynamicChoices: true,
        },
      ],
    },
  ],
  load: () => import('./importer'),
};
