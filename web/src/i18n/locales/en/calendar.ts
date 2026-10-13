import type { Strings } from '@/strings';

export const calendar: Strings['calendar'] = {
  dayLabel: (day: string, n: number) =>
    n === 0 ? day : n === 1 ? `${day}, 1 entry` : `${day}, ${n} entries`,
  meta: {
    name: 'Calendar',
    description:
      'Events in month, week and day view – also shows due dates and deadlines from other modules (to-dos, reminders, invoices, subscriptions, contracts, birthdays, pantry).',
    route: 'Calendar',
    widget: 'Today & tomorrow',
    quickAdd: 'Event',
    settings: {
      defaultView: 'Default view',
      defaultView_month: 'Month',
      defaultView_week: 'Week',
      defaultView_day: 'Day',
      defaultReminderTime: 'Default time for new reminders',
      allDayNotifyTime: 'Notification time for all-day events',
      timeHelp: 'Format HH:mm, e.g. 09:00',
    },
  },
  title: 'Calendar',
  today: 'Today',
  month: 'Month',
  week: 'Week',
  day: 'Day',
  view: 'View',
  prev: 'Back',
  next: 'Next',
  newEvent: 'New event',
  editEvent: 'Edit event',
  allDay: 'All day',
  start: 'Start',
  end: 'End',
  location: 'Location',
  showOnMap: 'Show on map',
  nothing: 'No entries',
  endBeforeStart: 'The end can’t be before the start.',
  more: (n: number) => `+${n} more`,
  agenda: 'Agenda',
  allDayRow: 'All day and without a time',
  timeGrid: 'Time grid',
  widgetEmpty: 'Nothing planned.',
  stageBody: (minutes: number, time: string) =>
    (minutes >= 1440
      ? minutes === 1440
        ? 'Tomorrow'
        : `In ${Math.round(minutes / 1440)} days`
      : minutes >= 60
        ? `In ${Math.round(minutes / 60)} h`
        : `In ${minutes} min`) + ` · ${time}`,
  followUpTitle: (title: string) => `Still relevant? ${title}`,
  untilNext: {
    empty: 'Nothing else is planned for today.',
    off: 'Time until the next event is turned off.',
  },
  reminders: {
    title: 'Reminders',
    add: 'Add reminder',
    edit: 'Edit reminder',
    empty: 'No reminders yet.',
    next: 'Next',
    ended: 'Ended',
    paused: 'Paused',
    active: 'Active',
    widgetEmpty: 'No upcoming reminders.',
  },
  notify: {
    label: 'Notify',
    none: 'Don’t notify',
    atStart: 'At start',
    minutes: (n: number) => (n === 1 ? '1 minute before' : `${n} minutes before`),
    hour: '1 hour before',
    day: '1 day before',
  },
  tabsLabel: 'View',
  tabCalendar: 'Calendar',
  tabReminders: 'Reminders',
  kinds: {
    event: 'Event',
    task: 'To-do',
    reminder: 'Reminder',
    invoice: 'Invoice',
    subscription: 'Subscription',
    cancel: 'Cancellation',
    birthday: 'Birthday',
    end: 'Contract end',
    expiry: 'Expiry',
    external: 'External',
  } as Record<string, string>,
  external: {
    title: 'External event',
    readOnly: 'This event comes from an external calendar. Change it there; here it is read-only.',
    open: 'Open in calendar service',
    from: (source: string) => `Source: ${source}`,
    sources: { google: 'Google Calendar', ics: 'Calendar subscription (ICS)' } as Record<
      string,
      string
    >,
    note: 'Note',
  },
};
