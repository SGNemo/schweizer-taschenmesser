import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Valor',
  invalidAmount: (sample: string) => `Informe um valor válido, por exemplo ${sample}`,
  currency: 'Moeda',
  currencyOther: 'Outra …',
  currencyCode: 'Código da moeda (3 letras)',
  currencyInvalid: 'Informe um código de moeda válido, p. ex. USD.',
  currencyHint: 'Nada é convertido: os valores ficam na própria moeda.',
};
