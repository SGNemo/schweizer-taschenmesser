import type { Strings } from '@/strings';

export const groups: Strings['groups'] = {
  overdue: 'En retard',
  waiting: 'En attente',
  today: 'Aujourd’hui',
  tomorrow: 'Demain',
  week: 'Cette semaine',
  later: 'Plus tard',
  none: 'Sans date',
  due: 'À échéance',
  paid: 'Payé',
  open: 'Ouvert',
  done: 'Terminé',
  collapse: (label: string) => `Replier ${label}`,
  expand: (label: string) => `Déplier ${label}`,
  count: (n: number) => `${n} ${n <= 1 ? 'entrée' : 'entrées'}`,
};
