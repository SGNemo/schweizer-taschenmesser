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
      priceHint: 'Aviso de subida de precio',
      priceHintHelp:
        'Muestra una vez en «Importante ahora» cuando una suscripción se encarece. Puedes desactivarlo en cualquier momento.',
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
  pause: 'Pausar',
  resume: 'Reanudar',
  empty: 'Aún no hay suscripciones.',
  perMonth: 'Al mes',
  perYear: 'Al año',
  nextCharge: 'Próximo cargo',
  cancelBy: 'Cancelar antes del',
  ended: 'Finalizada',
  cancelledTo: 'Cancelado para el (opcional)',
  cancelledToHint: 'Después ya no hay cobros ni plazos.',
  cancelledBadge: (date: string) => `Cancelado para el ${date}`,
  priceHistory: 'Historial de precios',
  priceChange: (date: string, from: string, to: string, pct: number) =>
    `${date}: ${from} → ${to} (${pct > 0 ? '+' : ''}${pct} %)`,
  priceUp: (pct: number) => `Precio subido (+${pct} %)`,
  every: 'Intervalo',
  widgetEmpty: 'No hay suscripciones activas.',
  monthlyCost: (v: string) => `≙ ${v} al mes`,
};
