import type { Strings } from '@/strings';

export const homeAuto: Strings['homeAuto'] = {
  entries: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  open: (name: string) => `Open ${name}`,
};
