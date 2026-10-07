import type { Strings } from '@/strings';

export const calendar: Strings['calendar'] = {
  dayLabel: (day: string, n: number) =>
    n === 0 ? day : n === 1 ? `${day}, 1 Eintrag` : `${day}, ${n} Einträge`,
  meta: {
    name: 'Kalender',
    description:
      'Termine in Monats-, Wochen- und Tagesansicht – zeigt auch Fälligkeiten und Fristen anderer Module (ToDos, Erinnerungen, Rechnungen, Abos, Verträge, Geburtstage, Vorräte).',
    route: 'Kalender',
    widget: 'Heute & Morgen',
    quickAdd: 'Termin',
    settings: {
      defaultView: 'Standardansicht',
      defaultView_month: 'Monat',
      defaultView_week: 'Woche',
      defaultView_day: 'Tag',
      defaultReminderTime: 'Standard-Uhrzeit für neue Erinnerungen',
      allDayNotifyTime: 'Uhrzeit der Benachrichtigung bei ganztägigen Terminen',
      timeHelp: 'Format HH:mm, z. B. 09:00',
    },
  },
  title: 'Kalender',
  today: 'Heute',
  month: 'Monat',
  week: 'Woche',
  day: 'Tag',
  view: 'Ansicht',
  prev: 'Zurück',
  next: 'Weiter',
  newEvent: 'Neuer Termin',
  editEvent: 'Termin bearbeiten',
  allDay: 'Ganztägig',
  start: 'Beginn',
  end: 'Ende',
  location: 'Ort',
  showOnMap: 'Auf der Karte zeigen',
  nothing: 'Keine Einträge',
  endBeforeStart: 'Das Ende darf nicht vor dem Beginn liegen.',
  more: (n: number) => `+${n} weitere`,
  agenda: 'Agenda',
  allDayRow: 'Ganztägig und ohne Uhrzeit',
  timeGrid: 'Zeitraster',
  widgetEmpty: 'Nichts geplant.',
  stageBody: (minutes: number, time: string) =>
    (minutes >= 1440
      ? minutes === 1440
        ? 'Morgen'
        : `In ${Math.round(minutes / 1440)} Tagen`
      : minutes >= 60
        ? `In ${Math.round(minutes / 60)} Std`
        : `In ${minutes} Min`) + ` · ${time}`,
  followUpTitle: (title: string) => `Noch aktuell? ${title}`,
  untilNext: {
    empty: 'Heute ist nichts mehr geplant.',
    off: 'Die Zeit bis zum nächsten Termin ist ausgeschaltet.',
  },
  reminders: {
    title: 'Erinnerungen',
    add: 'Erinnerung hinzufügen',
    edit: 'Erinnerung bearbeiten',
    empty: 'Noch keine Erinnerungen.',
    next: 'Nächste',
    ended: 'Beendet',
    paused: 'Pausiert',
    active: 'Aktiv',
    widgetEmpty: 'Keine anstehenden Erinnerungen.',
  },
  notify: {
    label: 'Benachrichtigen',
    none: 'Nicht benachrichtigen',
    atStart: 'Zum Beginn',
    minutes: (n: number) => `${n} Minuten vorher`,
    hour: '1 Stunde vorher',
    day: '1 Tag vorher',
  },
  tabsLabel: 'Ansicht',
  tabCalendar: 'Kalender',
  tabReminders: 'Erinnerungen',
  kinds: {
    event: 'Termin',
    task: 'ToDo',
    reminder: 'Erinnerung',
    invoice: 'Rechnung',
    subscription: 'Abo',
    cancel: 'Kündigung',
    birthday: 'Geburtstag',
    end: 'Vertragsende',
    expiry: 'Ablauf',
    external: 'Extern',
  } as Record<string, string>,
  external: {
    title: 'Externer Termin',
    readOnly:
      'Dieser Termin kommt aus einem externen Kalender. Ändere ihn dort; hier ist er nur lesbar.',
    open: 'Im Kalender-Dienst öffnen',
    from: (source: string) => `Quelle: ${source}`,
    sources: { google: 'Google Kalender', ics: 'Kalender-Abo (ICS)' } as Record<string, string>,
    note: 'Notiz',
  },
};
