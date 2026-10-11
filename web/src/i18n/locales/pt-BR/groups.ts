import type { Strings } from '@/strings';

export const groups: Strings['groups'] = {
  overdue: 'Atrasado',
  waiting: 'Esperando',
  today: 'Hoje',
  tomorrow: 'Amanhã',
  week: 'Esta semana',
  later: 'Mais tarde',
  none: 'Sem data',
  due: 'A vencer',
  paid: 'Pago',
  open: 'Em aberto',
  done: 'Concluído',
  collapse: (label: string) => `Recolher ${label}`,
  expand: (label: string) => `Expandir ${label}`,
  count: (n: number) => `${n} ${n === 0 || n === 1 ? 'entrada' : 'entradas'}`,
};
