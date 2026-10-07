import type { Strings } from '@/strings';

export const calendar: Strings['calendar'] = {
  dayLabel: (day: string, n: number) =>
    n === 0 ? day : n === 1 ? `${day}, 1 entrée` : `${day}, ${n} entrées`,
  meta: {
    name: 'Calendrier',
    description:
      'Événements en vue mois, semaine et jour – affiche aussi les échéances et délais des autres modules (Tâches, Rappels, Factures, Abonnements, contrats, anniversaires, Provisions).',
    route: 'Calendrier',
    widget: 'Aujourd’hui et demain',
    quickAdd: 'Événement',
    settings: {
      defaultView: 'Vue par défaut',
      defaultView_month: 'Mois',
      defaultView_week: 'Semaine',
      defaultView_day: 'Jour',
      defaultReminderTime: 'Heure par défaut des nouveaux rappels',
      allDayNotifyTime: 'Heure de notification des événements sur toute la journée',
      timeHelp: 'Format HH:mm, p. ex. 09:00',
    },
  },
  title: 'Calendrier',
  today: 'Aujourd’hui',
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
  view: 'Vue',
  prev: 'Précédent',
  next: 'Suivant',
  newEvent: 'Nouvel événement',
  editEvent: 'Modifier l’événement',
  allDay: 'Toute la journée',
  start: 'Début',
  end: 'Fin',
  location: 'Lieu',
  showOnMap: 'Afficher sur la carte',
  nothing: 'Aucune entrée',
  endBeforeStart: 'La fin ne peut pas être avant le début.',
  more: (n: number) => `+${n} de plus`,
  agenda: 'Agenda',
  allDayRow: 'Toute la journée et sans heure',
  timeGrid: 'Grille horaire',
  widgetEmpty: 'Rien de prévu.',
  stageBody: (minutes: number, time: string) =>
    (minutes >= 1440
      ? minutes === 1440
        ? 'Demain'
        : `Dans ${Math.round(minutes / 1440)} jours`
      : minutes >= 60
        ? `Dans ${Math.round(minutes / 60)} h`
        : `Dans ${minutes} min`) + ` · ${time}`,
  followUpTitle: (title: string) => `Toujours d’actualité ? ${title}`,
  untilNext: {
    empty: 'Plus rien de prévu aujourd’hui.',
    off: 'Le temps jusqu’au prochain événement est désactivé.',
  },
  reminders: {
    title: 'Rappels',
    add: 'Ajouter un rappel',
    edit: 'Modifier le rappel',
    empty: 'Aucun rappel pour l’instant.',
    next: 'Prochain',
    ended: 'Terminé',
    paused: 'En pause',
    active: 'Actif',
    widgetEmpty: 'Aucun rappel à venir.',
  },
  notify: {
    label: 'Notifier',
    none: 'Ne pas notifier',
    atStart: 'Au début',
    minutes: (n: number) => (n <= 1 ? `${n} minute avant` : `${n} minutes avant`),
    hour: '1 heure avant',
    day: '1 jour avant',
  },
  tabsLabel: 'Vue',
  tabCalendar: 'Calendrier',
  tabReminders: 'Rappels',
  kinds: {
    event: 'Événement',
    task: 'Tâche',
    reminder: 'Rappel',
    invoice: 'Facture',
    subscription: 'Abonnement',
    cancel: 'Résiliation',
    birthday: 'Anniversaire',
    end: 'Fin de contrat',
    expiry: 'Expiration',
    external: 'Externe',
  } as Record<string, string>,
  external: {
    title: 'Événement externe',
    readOnly:
      'Cet événement provient d’un calendrier externe. Modifiez-le là-bas ; ici, il est en lecture seule.',
    open: 'Ouvrir dans le service de calendrier',
    from: (source: string) => `Source : ${source}`,
    sources: { google: 'Google Agenda', ics: 'Abonnement calendrier (ICS)' } as Record<
      string,
      string
    >,
    note: 'Note',
  },
};
