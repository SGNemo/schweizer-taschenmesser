import type { Strings } from '@/strings';

export const homeAuto: Strings['homeAuto'] = {
  entries: (n: number) => (n === 0 || n === 1 ? `${n} entrada` : `${n} entradas`),
  open: (name: string) => `Abrir ${name}`,
};
