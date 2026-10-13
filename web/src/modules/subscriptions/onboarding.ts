import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.subscriptions;

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
          key: 'name',
          get label() {
            return s.name;
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
          placeholder: '9,99',
        },
        {
          key: 'rhythm',
          get label() {
            return s.rhythm;
          },
          type: 'select',
          defaultValue: 'monthly',
          choices: [
            {
              value: 'monthly',
              get label() {
                return s.monthly;
              },
            },
            {
              value: 'quarterly',
              get label() {
                return s.quarterly;
              },
            },
            {
              value: 'yearly',
              get label() {
                return s.yearly;
              },
            },
          ],
        },
        {
          key: 'next',
          get label() {
            return s.next;
          },
          type: 'date',
          required: true,
        },
        {
          key: 'notice',
          get label() {
            return s.notice;
          },
          type: 'number',
        },
      ],
    },
    {
      id: 'bank',
      kind: 'file',
      get label() {
        return s.bank;
      },
      get description() {
        return s.bankHint;
      },
      accept: '.csv,.xml,text/csv,text/xml',
    },
    {
      id: 'mail',
      kind: 'connector',
      connectorId: 'google',
      connectorFeature: 'mail',
      get label() {
        return t.onboarding.mail.subscriptions;
      },
      get description() {
        return t.onboarding.mail.hint;
      },
    },
  ],
  load: () => import('./importer'),
};
