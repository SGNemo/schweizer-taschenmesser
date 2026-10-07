import type { Strings } from '@/strings';

export const vault: Strings['vault'] = {
  meta: {
    name: 'Unterlagen',
    description:
      'Ausweise, Verträge, Versicherungen und Garantien mit Ende, Kündigungsfrist und angehängter Datei – im Kalender und mit Erinnerung, bevor eine Frist verstreicht. Dateien bleiben nur auf diesem Gerät.',
    route: 'Unterlagen',
    widget: 'Fristen & Ablauf',
    quickAdd: 'Unterlage',
    settings: {
      remindDaysBefore: 'Erinnerung vor Ablauf (Tage)',
      remindDaysBeforeDeadline: 'Erinnerung vor Kündigungsfrist (Tage)',
      remindTime: 'Uhrzeit der Erinnerung',
      remindTimeHelp: 'Format HH:mm',
    },
  },
  title: 'Unterlagen',
  add: 'Unterlage hinzufügen',
  edit: 'Unterlage bearbeiten',
  category: 'Kategorie',
  allCategories: 'Alle',
  categories: {
    identity: 'Ausweise',
    insurance: 'Versicherung',
    contract: 'Verträge',
    warranty: 'Garantien',
    tax: 'Steuer',
    health: 'Gesundheit',
    other: 'Sonstiges',
  } as Record<string, string>,
  provider: 'Anbieter',
  startDate: 'Beginn',
  endDate: 'Ende / Ablauf',
  noticeDays: 'Kündigungsfrist (Tage vor Ende)',
  noticeHint: 'Leer lassen, wenn es keine Frist gibt (z. B. bei Ausweisen oder Garantien).',
  invalid: 'Bitte die Angaben prüfen (das Ende darf nicht vor dem Beginn liegen).',
  endLabel: 'Ende',
  deadlineLabel: 'Kündigen bis',
  endsOn: (title: string, category: string) =>
    category === 'warranty'
      ? `Garantie endet: ${title}`
      : category === 'contract' || category === 'insurance'
        ? `Vertragsende: ${title}`
        : `Läuft ab: ${title}`,
  cancelBy: (title: string) => `Kündigungsfrist: ${title}`,
  remindBody: (date: string) => `Am ${date.split('-').reverse().join('.')}`,
  file: 'Datei',
  localOnly:
    'Dateien bleiben nur auf diesem Gerät: Sie werden weder synchronisiert noch ins Backup geschrieben. Titel, Ablaufdatum und Notizen werden wie üblich synchronisiert.',
  fileElsewhere: 'Datei nur auf einem anderen Gerät',
  removeFile: 'Datei entfernen',
  tooLarge: (max: string) => `Die Datei ist zu groß (höchstens ${max}).`,
  download: 'Herunterladen',
  search: 'Unterlagen durchsuchen',
  status: {
    expired: 'Abgelaufen',
    'act-now': 'Jetzt kündigen',
    soon: 'Bald',
    ok: '',
    'open-ended': '',
  } as Record<string, string>,
  empty: 'Noch keine Unterlagen.',
  emptyFiltered: 'Nichts gefunden.',
  widgetEmpty: 'Keine Fristen in Sicht.',
};
