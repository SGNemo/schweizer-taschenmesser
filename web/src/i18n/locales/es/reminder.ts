import type { Strings } from '@/strings';

export const reminder: Strings['reminder'] = {
  center: {
    title: 'Recordatorios',
    bell: (n: number) =>
      n === 0 ? 'Recordatorios' : `Recordatorios, ${n} ${n === 1 ? 'pendiente' : 'pendientes'}`,
    next: 'Próximo recordatorio',
    random: 'Recordatorio al azar',
    another: 'Otro más',
    allRead: 'Todo leído',
    list: 'Pendientes',
    none: 'No hay recordatorios pendientes.',
    upcoming: (when: string) => `Lo siguiente: ${when}`,
    count: (n: number) => (n === 1 ? '1 pendiente' : `${n} pendientes`),
    doneAria: (title: string) => `${title}: hecho`,
    doneToast: 'Hecho.',
    allDoneToast: 'Todo marcado como leído.',
  },
  label: 'Recordatorio',
  done: 'Hecho',
  later: 'Más tarde',
  open: 'Abrir',
  more: (n: number) => `+ ${n} más`,
  laterOptions: {
    '10min': 'En 10 min',
    '1h': 'En 1 h',
    evening: 'Esta noche',
    tomorrow: 'Mañana temprano',
    pc: 'Cuando esté en el PC',
  },
  snoozed: {
    '10min': 'Vale, en 10 minutos.',
    '1h': 'Vale, en una hora.',
    evening: 'Vale, esta noche.',
    tomorrow: 'Vale, mañana temprano.',
    pc: 'Vale, cuando estés en el PC.',
  },
};
