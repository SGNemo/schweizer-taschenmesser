import type { Strings } from '@/strings';

export const habits: Strings['habits'] = {
  meta: {
    name: 'Habitudes',
    description:
      'Objectifs quotidiens et hebdomadaires avec des anneaux : une coche ou un nombre comme « 8 verres », avec jours de repos, historique et rappels qui s’arrêtent dès que l’objectif du jour est atteint.',
    quickAdd: 'Habitude',
    widget: 'Aujourd’hui',
    settings: {
      remindersEnabled: 'Rappels des habitudes',
      remindersHelp: 'Désactivé : aucun rappel, les anneaux restent.',
    },
  },
  title: 'Habitudes',
  tabs: { label: 'Vue', today: 'Aujourd’hui', history: 'Historique', archive: 'Archives' },
  empty: 'Pas encore d’habitudes.',
  emptyHint:
    'Commencez petit : par exemple « Boire de l’eau » avec un nombre et un rappel dans une plage horaire.',
  add: 'Ajouter une habitude',
  edit: 'Modifier l’habitude',
  form: {
    name: 'Nom',
    kind: 'Type',
    yesno: 'Oui/Non',
    count: 'Nombre',
    target: 'Objectif par jour',
    unit: 'Unité (p. ex. verres)',
    period: 'Rythme',
    day: 'Tous les jours',
    week: 'Plusieurs fois par semaine',
    weeklyTimes: 'Fois par semaine',
    weekdays: 'Jours de la semaine',
    weekdaysHint: 'Aucune sélection = tous les jours.',
    reminder: 'Rappel',
    reminderOff: 'Désactivé',
    reminderTime: 'À une heure',
    reminderWindow: 'Dans une plage horaire',
    at: 'Heure',
    from: 'De',
    to: 'Jusqu’à',
    every: 'Toutes les (minutes)',
    reminderHint:
      'Dans une plage horaire, l’app rappelle jusqu’à ce que l’objectif du jour soit atteint, puis plus.',
    templates: 'Modèles',
  },
  templates: {
    water: { name: 'Boire de l’eau', unit: 'verres' },
    walk: { name: 'Aller se promener', unit: '' },
    stretch: { name: 'S’étirer', unit: '' },
    pill: { name: 'Prendre le médicament', unit: '' },
  },
  today: {
    progress: (n: number, target: number, unit?: string) =>
      `${n} sur ${target}${unit ? ` ${unit}` : ''}`,
    done: 'Fait',
    plus: '+1',
    minus: '−1',
    markDone: 'Fait',
    undo: 'Annuler',
    rest: 'Jour de repos',
    restOn: 'Jour de repos : aujourd’hui ne compte pas.',
    restOff: 'Retirer le jour de repos',
    weekProgress: (done: number, of: number) => `${done} sur ${of} cette semaine`,
    plusFor: (name: string) => `+1 ${name}`,
    minusFor: (name: string) => `−1 ${name}`,
    nothing: 'Rien de prévu aujourd’hui.',
  },
  history: {
    pick: 'Habitude',
    last30: '30 derniers jours',
    ofDays: (done: number, of: number) => `${done} sur ${of} jours prévus`,
    ofWeeks: (done: number, of: number) => `${done} sur ${of} semaines réussies`,
    perWeekday: 'Par jour de la semaine',
    best: (n: number) => `Plus longue série : ${n}`,
    grid: 'La dernière année, une colonne par semaine',
    legend: {
      done: 'Fait',
      partial: 'En partie',
      open: 'Ouvert',
      rest: 'Jour de repos',
      off: 'Non prévu',
    },
    noData: 'Rien ne compte encore sur cette période.',
    cell: (date: string, state: string, count: number) =>
      `${date} : ${state}${count > 0 ? `, ${count}` : ''}`,
  },
  archive: {
    empty: 'Rien d’archivé.',
    archived: 'Archivé.',
    restored: 'De nouveau actif.',
    archiveAction: 'Archiver',
    restoreAction: 'Restaurer',
  },
  notify: {
    body: (n: number, target: number, unit?: string) =>
      `${n} sur ${target}${unit ? ` ${unit}` : ''}`,
  },
  widget: {
    summary: (done: number, of: number) => `${done} sur ${of} faits`,
    detail: (n: number, target: number, unit?: string) =>
      `${n} sur ${target}${unit ? ` ${unit}` : ''}`,
    plusFor: (name: string) => `+1 ${name}`,
    empty: 'Pas encore d’habitudes.',
    addAction: 'Créer une habitude',
  },
  head: {
    label: 'Aujourd’hui',
    value: (done: number, of: number) => `${done}/${of}`,
    none: 'Rien de prévu',
  },
};
