import type { Strings } from '@/strings';

export const groups: Strings['groups'] = {
  overdue: 'Überfällig',
  waiting: 'Wartet noch',
  today: 'Heute',
  tomorrow: 'Morgen',
  week: 'Diese Woche',
  later: 'Später',
  none: 'Ohne Datum',
  due: 'Fällig',
  paid: 'Bezahlt',
  open: 'Offen',
  done: 'Erledigt',
  collapse: (label: string) => `${label} einklappen`,
  expand: (label: string) => `${label} ausklappen`,
  count: (n: number) => `${n} ${n === 1 ? 'Eintrag' : 'Einträge'}`,
};
