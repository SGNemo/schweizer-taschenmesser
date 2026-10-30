import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.notes;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'file',
      kind: 'file',
      multiple: true,
      get label() {
        return s.file;
      },
      get description() {
        return s.fileHint;
      },
      accept: '.md,.markdown,.txt,.json,text/markdown,text/plain,application/json',
    },
    {
      id: 'text',
      kind: 'text',
      get label() {
        return s.text;
      },
      get description() {
        return s.textHint;
      },
      get textLabel() {
        return s.textLabel;
      },
      get placeholder() {
        return s.placeholder;
      },
    },
  ],
  load: () => import('./importer'),
};
