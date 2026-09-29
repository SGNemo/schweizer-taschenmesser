import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.subscriptions;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'form',
      kind: 'form',
      label: s.form,
      fields: [
        { key: 'name', label: s.name, type: 'text', required: true },
        { key: 'amount', label: s.amount, type: 'text', required: true, placeholder: '9,99' },
        {
          key: 'rhythm',
          label: s.rhythm,
          type: 'select',
          defaultValue: 'monthly',
          choices: [
            { value: 'monthly', label: s.monthly },
            { value: 'quarterly', label: s.quarterly },
            { value: 'yearly', label: s.yearly },
          ],
        },
        { key: 'next', label: s.next, type: 'date', required: true },
        { key: 'notice', label: s.notice, type: 'number' },
      ],
    },
  ],
  load: () => import('./importer'),
};
