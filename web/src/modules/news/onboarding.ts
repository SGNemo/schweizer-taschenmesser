import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';
import { CATEGORIES } from './schema';
import { STARTER_FEEDS } from './starter';

const s = t.onboarding.news;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'starter',
      kind: 'template',
      label: s.starter,
      description: s.starterHint,
      templates: STARTER_FEEDS.map((f) => ({
        id: f.id,
        label: f.title,
        detail: t.news.categories[f.category],
        preselected: true,
      })),
    },
    {
      id: 'url',
      kind: 'form',
      label: s.byUrl,
      description: s.byUrlHint,
      fields: [
        { key: 'url', label: s.url, type: 'text', required: true, placeholder: 'https://…' },
        {
          key: 'category',
          label: s.category,
          type: 'select',
          defaultValue: 'nachrichten',
          choices: CATEGORIES.map((c) => ({ value: c, label: t.news.categories[c]! })),
        },
      ],
    },
  ],
  load: () => import('./importer'),
};
