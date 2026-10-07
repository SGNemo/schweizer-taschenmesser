import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  importDetail: (amount: string, rhythm: string, next: string) =>
    `${amount} · ${rhythm} · prochain prélèvement ${next}`,
  cancelTitle: (name: string) => `Fin du délai de résiliation : ${name}`,
  cancelBody: (last: string, amount: string, charge: string) =>
    `Dernier jour : ${last} – sinon ${amount} le ${charge}`,
  cancelCalendar: (name: string) => `Délai de résiliation : ${name}`,
  meta: {
    name: 'Abonnements',
    description:
      'Abonnements et paiements récurrents : prochain prélèvement, délai de résiliation et total par mois et par an.',
    route: 'Abonnements',
    widget: 'Prochains prélèvements',
    quickAdd: 'Abonnement',
    settings: {
      cancelRemindDaysBefore: 'Rappel avant la fin du délai de résiliation (jours)',
      cancelRemindDaysBeforeHelp: '0 = le dernier jour du délai',
      remindTime: 'Heure du rappel',
      remindTimeHelp: 'Au format HH:mm',
    },
  },
  title: 'Abonnements',
  add: 'Ajouter un abonnement',
  edit: 'Modifier l’abonnement',
  name: 'Nom',
  firstCharge: 'Prélèvement le',
  noticeDays: 'Délai de résiliation (jours avant le prélèvement)',
  noticeHint: 'Laissez vide s’il est résiliable à tout moment.',
  active: 'Actif',
  paused: 'En pause',
  empty: 'Aucun abonnement pour l’instant.',
  perMonth: 'Par mois',
  perYear: 'Par an',
  nextCharge: 'Prochain prélèvement',
  cancelBy: 'Résilier avant le',
  ended: 'Terminé',
  every: 'Intervalle',
  widgetEmpty: 'Aucun abonnement actif.',
  monthlyCost: (v: string) => `≙ ${v} par mois`,
};
