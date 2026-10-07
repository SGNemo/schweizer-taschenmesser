import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  importDetail: (amount: string, rhythm: string, next: string) =>
    `${amount} · ${rhythm} · próximo cargo ${next}`,
  cancelTitle: (name: string) => `Termina el plazo de cancelación: ${name}`,
  cancelBody: (last: string, amount: string, charge: string) =>
    `Último día: ${last}; si no, ${amount} el ${charge}`,
  cancelCalendar: (name: string) => `Plazo de cancelación: ${name}`,
  meta: {
    name: 'Suscripciones',
    description:
      'Suscripciones y pagos recurrentes: próximo cargo, plazo de cancelación y el total al mes y al año.',
    route: 'Suscripciones',
    widget: 'Próximos cargos',
    quickAdd: 'Suscripción',
    settings: {
      cancelRemindDaysBefore: 'Recordatorio antes de que acabe el plazo de cancelación (días)',
      cancelRemindDaysBeforeHelp: '0 = el último día del plazo',
      remindTime: 'Hora del recordatorio',
      remindTimeHelp: 'Formato HH:mm',
    },
  },
  title: 'Suscripciones',
  add: 'Añadir suscripción',
  edit: 'Editar suscripción',
  name: 'Nombre',
  firstCharge: 'Cargo el',
  noticeDays: 'Plazo de cancelación (días antes del cargo)',
  noticeHint: 'Déjalo vacío si se puede cancelar en cualquier momento.',
  active: 'Activa',
  paused: 'En pausa',
  empty: 'Aún no hay suscripciones.',
  perMonth: 'Al mes',
  perYear: 'Al año',
  nextCharge: 'Próximo cargo',
  cancelBy: 'Cancelar antes del',
  ended: 'Finalizada',
  every: 'Intervalo',
  widgetEmpty: 'No hay suscripciones activas.',
  monthlyCost: (v: string) => `≙ ${v} al mes`,
};
