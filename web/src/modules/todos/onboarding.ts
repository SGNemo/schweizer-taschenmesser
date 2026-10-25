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
    {
      id: 'file',
      kind: 'file',
      get label() {
        return t.onboarding.todos.file;
      },
      get description() {
        return t.onboarding.todos.fileHint;
      },
      accept: '.csv,.json,text/csv,application/json',
      options: [
        {
          key: 'fileList',
          get label() {
            return t.onboarding.todos.list;
          },
          type: 'select',
          dynamicChoices: true,
        },
        {
          key: 'includeDone',
          get label() {
            return t.onboarding.todos.includeDone;
          },
          type: 'select',
          get choices() {
            return [
              { value: 'no', label: t.onboarding.todos.doneNo },
              { value: 'yes', label: t.onboarding.todos.doneYes },
            ];
          },
        },
      ],
    },
  ],
  load: () => import('./importer'),
};
