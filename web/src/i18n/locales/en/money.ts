import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Amount',
  invalidAmount: (sample: string) => `Please enter a valid amount, e.g. ${sample}`,
};
