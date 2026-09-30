import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';
import { PRESETS } from './logic';

const s = t.onboarding.launcher;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'presets',
      kind: 'template',
      label: s.presets,
      description: s.presetsHint,
      templates: PRESETS.map((p) => ({ id: p.id, label: p.title, detail: p.group })),
    },
    {
      id: 'link',
      kind: 'form',
      label: s.single,
      fields: [
        { key: 'title', label: s.title, type: 'text', required: true },
        { key: 'url', label: s.url, type: 'text', required: true, placeholder: 'https://…' },
        { key: 'group', label: s.group, type: 'text' },
      ],
    },
  ],
  load: () => import('./importer'),
};
