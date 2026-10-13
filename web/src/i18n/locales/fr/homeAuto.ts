import type { Strings } from '@/strings';

export const homeAuto: Strings['homeAuto'] = {
  entries: (n: number) => (n <= 1 ? `${n} entrée` : `${n} entrées`),
  open: (name: string) => `Ouvrir ${name}`,
};
