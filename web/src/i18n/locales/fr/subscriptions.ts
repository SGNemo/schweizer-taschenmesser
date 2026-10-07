import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  importDetail: (amount: string, rhythm: string, next: string) =>
    `${amount} · ${rhythm} · nächste Abbuchung ${next}`,
  cancelTitle: (name: string) => `Kündigungsfrist endet: ${name}`,
  cancelBody: (last: string, amount: string, charge: string) =>
    `Letzter Tag: ${last} – sonst ${amount} am ${charge}`,
  cancelCalendar: (name: string) => `Kündigungsfrist: ${name}`,
  meta: {
    name: 'Abos',
    description:
      'Abos und wiederkehrende Zahlungen: nächste Abbuchung, Kündigungsfrist und die Summe pro Monat und Jahr.',
    route: 'Abos',
    widget: 'Nächste Abbuchungen',
    quickAdd: 'Abo',
    settings: {
      cancelRemindDaysBefore: 'Erinnerung vor Ende der Kündigungsfrist (Tage)',
      cancelRemindDaysBeforeHelp: '0 = am letzten Tag der Frist',
      remindTime: 'Uhrzeit der Erinnerung',
      remindTimeHelp: 'Format HH:mm',
    },
  },
  title: 'Abos',
  add: 'Abo hinzufügen',
  edit: 'Abo bearbeiten',
  name: 'Name',
  firstCharge: 'Abbuchung am',
  noticeDays: 'Kündigungsfrist (Tage vor Abbuchung)',
  noticeHint: 'Leer lassen, wenn jederzeit kündbar.',
  active: 'Aktiv',
  paused: 'Pausiert',
  empty: 'Noch keine Abos.',
  perMonth: 'Pro Monat',
  perYear: 'Pro Jahr',
  nextCharge: 'Nächste Abbuchung',
  cancelBy: 'Kündigen bis',
  ended: 'Beendet',
  every: 'Intervall',
  widgetEmpty: 'Keine aktiven Abos.',
  monthlyCost: (v: string) => `≙ ${v} pro Monat`,
};
