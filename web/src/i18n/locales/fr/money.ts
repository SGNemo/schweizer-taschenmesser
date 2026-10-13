import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Montant',
  invalidAmount: (sample: string) => `Veuillez saisir un montant valide, par ex. ${sample}`,
};
