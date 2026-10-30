import type { Strings } from '@/strings';

export const money: Strings['money'] = {
  amount: 'Importe',
  invalidAmount: (sample: string) => `Introduce un importe válido, p. ej. ${sample}`,
  currency: 'Moneda',
  currencyOther: 'Otra …',
  currencyCode: 'Código de moneda (3 letras)',
  currencyInvalid: 'Introduce un código de moneda válido, p. ej. USD.',
  currencyHint: 'No se convierte nada: los importes siguen en su propia moneda.',
};
