import type { Strings } from '@/strings';

export const groups: Strings['groups'] = {
  overdue: 'Vencido',
  waiting: 'En espera',
  today: 'Hoy',
  tomorrow: 'Mañana',
  week: 'Esta semana',
  later: 'Más tarde',
  none: 'Sin fecha',
  due: 'Vence',
  paid: 'Pagado',
  open: 'Pendiente',
  done: 'Hecho',
  collapse: (label: string) => `Contraer ${label}`,
  expand: (label: string) => `Desplegar ${label}`,
  count: (n: number) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`,
};
