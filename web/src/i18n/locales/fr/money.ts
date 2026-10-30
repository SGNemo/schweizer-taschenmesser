import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Montant',
  invalidAmount: (sample: string) => `Veuillez saisir un montant valide, par ex. ${sample}`,
  currency: 'Devise',
  currencyOther: 'Autre …',
  currencyCode: 'Code de la devise (3 lettres)',
  currencyInvalid: 'Saisissez un code de devise valide, p. ex. USD.',
  currencyHint: 'Rien n’est converti : les montants restent dans leur devise.',
};
