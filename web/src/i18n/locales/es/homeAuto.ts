import type { Strings } from '@/strings';

export const homeAuto: Strings['homeAuto'] = {
  entries: (n: number) => (n === 1 ? '1 entrada' : `${n} entradas`),
  open: (name: string) => `Abrir ${name}`,
};
