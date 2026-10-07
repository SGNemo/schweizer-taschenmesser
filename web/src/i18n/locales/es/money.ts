import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Importe',
  invalidAmount: (sample: string) => `Introduce un importe válido, p. ej. ${sample}`,
};
