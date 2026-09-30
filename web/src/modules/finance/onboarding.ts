import type { OnboardingDef } from '@/core/importer/types';
import { t } from '@/strings';

const s = t.onboarding.finance;

export const onboarding: OnboardingDef = {
  importers: [
    {
      id: 'account',
      kind: 'form',
      label: s.account,
      description: s.accountHint,
      fields: [
        { key: 'name', label: s.name, type: 'text', required: true },
        {
          key: 'balance',
          label: s.balance,
          type: 'text',
          required: true,
          hint: s.balanceHint,
          defaultValue: '0,00',
        },
      ],
    },
    {
      id: 'bank',
      kind: 'file',
      label: s.bank,
      description: s.bankHint,
      accept: '.csv,.xml,text/csv,text/xml',
      options: [
        {
          key: 'accountId',
          label: s.bankAccount,
          type: 'select',
          required: true,
          dynamicChoices: true,
        },
      ],
    },
  ],
  load: () => import('./importer'),
};
