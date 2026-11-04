import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.feeds;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'file',
      kind: 'file',
      get label() {
        return s.file;
      },
      get description() {
        return s.fileHint;
      },
      accept: '.opml,.xml,text/xml,application/xml,text/x-opml',
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
      get placeholder() {
        return s.placeholder;
      },
    },
  ],
  load: () => import('./importer'),
};
