import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Valor',
  invalidAmount: (sample: string) => `Informe um valor válido, por exemplo ${sample}`,
};
