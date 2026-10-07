import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.invoices;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'form',
      kind: 'form',
      get label() {
        return s.form;
      },
      fields: [
        {
          key: 'payee',
          get label() {
            return s.payee;
          },
          type: 'text',
          required: true,
        },
        {
          key: 'amount',
          get label() {
            return s.amount;
          },
          type: 'text',
          required: true,
          placeholder: '49,90',
        },
        {
          key: 'due',
          get label() {
            return s.due;
          },
          type: 'date',
          required: true,
        },
        {
          key: 'reference',
          get label() {
            return s.reference;
          },
          type: 'text',
        },
      ],
    },
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      get label() {
        return t.onboarding.mail.invoices;
      },
      get description() {
        return t.onboarding.mail.hint;
      },
    },
  ],
  load: () => import('./importer'),
};
