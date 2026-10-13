import type { Strings } from '@/strings';

export const calendar: Strings['calendar'] = {
  dayLabel: (day: string, n: number) =>
    n === 0 ? day : n === 1 ? `${day}, 1 entrada` : `${day}, ${n} entradas`,
  meta: {
    name: 'Calendario',
    description:
      'Eventos en vista de mes, semana y día; también muestra vencimientos y plazos de otros módulos (Tareas, Recordatorios, Facturas, Suscripciones, Contratos, Cumpleaños, Despensa).',
    route: 'Calendario',
    widget: 'Hoy y mañana',
    quickAdd: 'Evento',
    settings: {
      defaultView: 'Vista predeterminada',
      defaultView_month: 'Mes',
      defaultView_week: 'Semana',
      defaultView_day: 'Día',
      defaultReminderTime: 'Hora predeterminada para nuevos recordatorios',
      allDayNotifyTime: 'Hora de notificación para eventos de todo el día',
      timeHelp: 'Formato HH:mm, p. ej. 09:00',
    },
  },
  title: 'Calendario',
  today: 'Hoy',
  month: 'Mes',
  week: 'Semana',
  day: 'Día',
  view: 'Vista',
  prev: 'Anterior',
  next: 'Siguiente',
  newEvent: 'Nuevo evento',
  editEvent: 'Editar evento',
  allDay: 'Todo el día',
  start: 'Inicio',
  end: 'Fin',
  location: 'Lugar',
  showOnMap: 'Ver en el mapa',
  nothing: 'Sin entradas',
  endBeforeStart: 'El fin no puede ser anterior al inicio.',
  more: (n: number) => `+${n} más`,
  agenda: 'Agenda',
  allDayRow: 'Todo el día y sin hora',
  timeGrid: 'Cuadrícula horaria',
  widgetEmpty: 'Nada planificado.',
  stageBody: (minutes: number, time: string) =>
    (minutes >= 1440
      ? minutes === 1440
        ? 'Mañana'
        : `En ${Math.round(minutes / 1440)} días`
      : minutes >= 60
        ? `En ${Math.round(minutes / 60)} h`
        : `En ${minutes} min`) + ` · ${time}`,
  followUpTitle: (title: string) => `¿Sigue vigente? ${title}`,
  untilNext: {
    empty: 'Hoy no hay nada más planificado.',
    off: 'El tiempo hasta el próximo evento está desactivado.',
  },
  reminders: {
    title: 'Recordatorios',
    add: 'Añadir recordatorio',
    edit: 'Editar recordatorio',
    empty: 'Aún no hay recordatorios.',
    next: 'Próximo',
    ended: 'Finalizado',
    paused: 'En pausa',
    active: 'Activo',
    widgetEmpty: 'No hay recordatorios próximos.',
  },
  notify: {
    label: 'Notificar',
    none: 'No notificar',
    atStart: 'Al inicio',
    minutes: (n: number) => (n === 1 ? '1 minuto antes' : `${n} minutos antes`),
    hour: '1 hora antes',
    day: '1 día antes',
  },
  tabsLabel: 'Vista',
  tabCalendar: 'Calendario',
  tabReminders: 'Recordatorios',
  kinds: {
    event: 'Evento',
    task: 'Tarea',
    reminder: 'Recordatorio',
    invoice: 'Factura',
    subscription: 'Suscripción',
    cancel: 'Cancelación',
    birthday: 'Cumpleaños',
    end: 'Fin de contrato',
    expiry: 'Caducidad',
    external: 'Externo',
  } as Record<string, string>,
  external: {
    title: 'Evento externo',
    readOnly: 'Este evento viene de un calendario externo. Cámbialo allí; aquí solo se puede leer.',
    open: 'Abrir en el servicio de calendario',
    from: (source: string) => `Origen: ${source}`,
    sources: {
      google: 'Google Calendar',
      ics: 'Suscripción de calendario (ICS)',
    } as Record<string, string>,
    note: 'Nota',
  },
};
