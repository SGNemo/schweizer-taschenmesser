import type { Strings } from '@/strings';

export const habits: Strings['habits'] = {
  meta: {
    name: 'Hábitos',
    description:
      'Metas diarias y semanales con anillos: una marca o un número como «8 vasos», con días de descanso, historial y avisos que se detienen al cumplir la meta del día.',
    quickAdd: 'Hábito',
    widget: 'Hecho hoy',
    settings: {
      remindersEnabled: 'Avisos de hábitos',
      remindersHelp: 'Desactivado: no llegan avisos, los anillos se mantienen.',
    },
  },
  title: 'Hábitos',
  tabs: { label: 'Vista', today: 'Hoy', history: 'Historial', archive: 'Archivo' },
  empty: 'Aún no hay hábitos.',
  emptyHint:
    'Empieza poco a poco: por ejemplo «Beber agua» con un número y un aviso en una franja horaria.',
  add: 'Añadir hábito',
  edit: 'Editar hábito',
  form: {
    name: 'Nombre',
    kind: 'Tipo',
    yesno: 'Sí/No',
    count: 'Número',
    target: 'Meta por día',
    unit: 'Unidad (p. ej. vasos)',
    period: 'Ritmo',
    day: 'Cada día',
    week: 'Varias veces por semana',
    weeklyTimes: 'Veces por semana',
    weekdays: 'Días de la semana',
    weekdaysHint: 'Sin selección = todos los días.',
    reminder: 'Aviso',
    reminderOff: 'Desactivado',
    reminderTime: 'A una hora',
    reminderWindow: 'En una franja horaria',
    at: 'Hora',
    from: 'Desde',
    to: 'Hasta',
    every: 'Cada (minutos)',
    reminderHint:
      'En una franja horaria la app avisa hasta cumplir la meta del día, y después ya no.',
    templates: 'Plantillas',
  },
  templates: {
    water: { name: 'Beber agua', unit: 'vasos' },
    walk: { name: 'Salir a caminar', unit: '' },
    stretch: { name: 'Estirar', unit: '' },
    pill: { name: 'Tomar la medicación', unit: '' },
  },
  today: {
    progress: (n: number, target: number, unit?: string) =>
      `${n} de ${target}${unit ? ` ${unit}` : ''}`,
    done: 'Hecho',
    plus: '+1',
    minus: '−1',
    markDone: 'Hecho',
    undo: 'Deshacer',
    rest: 'Día de descanso',
    restOn: 'Día de descanso: hoy no cuenta.',
    restOff: 'Quitar día de descanso',
    weekProgress: (done: number, of: number) => `${done} de ${of} esta semana`,
    plusFor: (name: string) => `+1 ${name}`,
    minusFor: (name: string) => `−1 ${name}`,
    nothing: 'Hoy no hay nada planificado.',
  },
  history: {
    pick: 'Hábito',
    last30: 'Últimos 30 días',
    ofDays: (done: number, of: number) => `${done} de ${of} días planificados`,
    ofWeeks: (done: number, of: number) => `${done} de ${of} semanas cumplidas`,
    perWeekday: 'Por día de la semana',
    best: (n: number) => `Racha más larga: ${n}`,
    grid: 'El último año, una columna por semana',
    legend: {
      done: 'Hecho',
      partial: 'En parte',
      open: 'Pendiente',
      rest: 'Día de descanso',
      off: 'No planificado',
    },
    noData: 'Todavía no cuenta nada en este periodo.',
    cell: (date: string, state: string, count: number) =>
      `${date}: ${state}${count > 0 ? `, ${count}` : ''}`,
  },
  archive: {
    empty: 'Nada archivado.',
    archived: 'Archivado.',
    restored: 'Activo de nuevo.',
    archiveAction: 'Archivar',
    restoreAction: 'Restaurar',
  },
  notify: {
    body: (n: number, target: number, unit?: string) =>
      `${n} de ${target}${unit ? ` ${unit}` : ''}`,
  },
  widget: {
    summary: (done: number, of: number) => `${done} de ${of} hechos`,
    detail: (n: number, target: number, unit?: string) =>
      `${n} de ${target}${unit ? ` ${unit}` : ''}`,
    plusFor: (name: string) => `+1 ${name}`,
    empty: 'Aún no hay hábitos.',
    addAction: 'Crear un hábito',
  },
  head: {
    label: 'Hoy',
    value: (done: number, of: number) => `${done}/${of}`,
    none: 'Nada planificado',
  },
};
