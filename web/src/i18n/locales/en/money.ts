import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Amount',
  invalidAmount: (sample: string) => `Please enter a valid amount, e.g. ${sample}`,
  currency: 'Currency',
  currencyOther: 'Other …',
  currencyCode: 'Currency code (3 letters)',
  currencyInvalid: 'Please enter a valid currency code, e.g. USD.',
  currencyHint: 'Nothing is converted: amounts stay in their own currency.',
};
