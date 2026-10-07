import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.finance;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'account',
      kind: 'form',
      get label() {
        return s.account;
      },
      get description() {
        return s.accountHint;
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
          key: 'balance',
          get label() {
            return s.balance;
          },
          type: 'text',
          required: true,
          get hint() {
            return s.balanceHint;
          },
          defaultValue: '0,00',
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
      options: [
        {
          key: 'accountId',
          get label() {
            return s.bankAccount;
          },
          type: 'select',
          required: true,
          dynamicChoices: true,
        },
      ],
    },
  ],
  load: () => import('./importer'),
};
