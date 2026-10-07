import type { Strings } from '@/strings';

export const homeAuto: Strings['homeAuto'] = {
  entries: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
  open: (name: string) => `${name} öffnen`,
};
