import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.bookmarks;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'html',
      kind: 'file',
      get label() {
        return s.html;
      },
      get description() {
        return s.htmlHint;
      },
      accept: '.html,.htm,text/html',
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
