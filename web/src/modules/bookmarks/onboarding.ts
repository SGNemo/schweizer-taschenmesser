import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.bookmarks;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'html',
      kind: 'file',
      label: s.html,
      description: s.htmlHint,
      accept: '.html,.htm,text/html',
    },
    {
      id: 'text',
      kind: 'text',
      label: s.text,
      description: s.textHint,
      placeholder: s.placeholder,
    },
  ],
  load: () => import('./importer'),
};
