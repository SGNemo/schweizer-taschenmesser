import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.invoices;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'form',
      kind: 'form',
      label: s.form,
      fields: [
        { key: 'payee', label: s.payee, type: 'text', required: true },
        { key: 'amount', label: s.amount, type: 'text', required: true, placeholder: '49,90' },
        { key: 'due', label: s.due, type: 'date', required: true },
        { key: 'reference', label: s.reference, type: 'text' },
      ],
    },
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      label: t.onboarding.mail.invoices,
      description: t.onboarding.mail.hint,
    },
  ],
  load: () => import('./importer'),
};
