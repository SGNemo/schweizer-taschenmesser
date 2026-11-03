import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  ext: {
    category: {
      label: 'Tipo de servicio',
      streaming: 'Streaming',
      music: 'Música',
      software: 'Software',
      cloud: 'Nube y almacenamiento',
      news: 'Noticias',
      mobility: 'Movilidad',
      sport: 'Deporte',
      insurance: 'Seguro',
      telecom: 'Teléfono e internet',
      other: 'Otros',
    },
    trial: {
      label: 'La prueba termina el',
      hint: 'Recibirás un aviso antes.',
      chip: 'Prueba',
      daysLeft: (n: number) =>
        n === 0
          ? 'La prueba termina hoy'
          : n === 1
            ? 'La prueba termina mañana'
            : `La prueba termina en ${n} días`,
      reminderTitle: (name: string) => `La prueba termina pronto: ${name}`,
      reminderBody: (date: string, price: string) => `Hasta el ${date}. Después ${price}.`,
      calendar: (name: string) => `Termina la prueba: ${name}`,
      remindDaysBefore: 'Aviso antes de que termine la prueba (días)',
      remindDaysBeforeHelp: '0 = el último día de la prueba',
    },
    status: { ended: 'Terminada' },
    payment: { label: 'Pagado con', placeholder: 'p. ej. domiciliación cuenta corriente' },
    monthlyShort: (amount: string) => `${amount} / mes`,
    top: { title: 'Las más caras', perYear: (amount: string) => `${amount} al año` },
    head: {
      title: 'Próximos cargos',
      nothing: 'Nada a la vista',
      on: (name: string, date: string, amount: string) => `${name}, ${date}: ${amount}`,
    },
    suggest: {
      apply: (amount: string) => `Adoptar el precio: ${amount}`,
      seen: (amount: string) => `Último cargo: ${amount}`,
    },
  },
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
