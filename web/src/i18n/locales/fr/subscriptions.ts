import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  ext: {
    category: {
      label: 'Type de service',
      streaming: 'Streaming',
      music: 'Musique',
      software: 'Logiciel',
      cloud: 'Cloud et stockage',
      news: 'Actualités',
      mobility: 'Mobilité',
      sport: 'Sport',
      insurance: 'Assurance',
      telecom: 'Téléphone et internet',
      other: 'Autre',
    },
    trial: {
      label: 'L’essai se termine le',
      hint: 'Vous recevez un rappel avant.',
      chip: 'Essai',
      daysLeft: (n: number) =>
        n === 0
          ? 'L’essai se termine aujourd’hui'
          : n === 1
            ? 'L’essai se termine demain'
            : `L’essai se termine dans ${n} jours`,
      reminderTitle: (name: string) => `L’essai se termine bientôt : ${name}`,
      reminderBody: (date: string, price: string) => `Jusqu’au ${date}. Ensuite ${price}.`,
      calendar: (name: string) => `Fin de l’essai : ${name}`,
      remindDaysBefore: 'Rappel avant la fin de l’essai (jours)',
    },
    status: { ended: 'Terminé' },
    payment: { label: 'Payé avec', placeholder: 'p. ex. prélèvement compte courant' },
    monthlyShort: (amount: string) => `${amount} / mois`,
    top: { title: 'Les plus chers', perYear: (amount: string) => `${amount} par an` },
    head: {
      title: 'Prochains prélèvements',
      nothing: 'Rien en vue',
      on: (name: string, date: string, amount: string) => `${name}, ${date} : ${amount}`,
    },
    suggest: {
      apply: (amount: string) => `Reprendre le prix : ${amount}`,
      seen: (amount: string) => `Dernier prélèvement : ${amount}`,
    },
  },
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
      priceHint: 'Avis en cas de hausse de prix',
      priceHintHelp:
        'Affiche une fois sous « Important maintenant » quand un abonnement devient plus cher. Vous pouvez le désactiver à tout moment.',
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
  pause: 'Mettre en pause',
  resume: 'Reprendre',
  empty: 'Aucun abonnement pour l’instant.',
  perMonth: 'Par mois',
  perYear: 'Par an',
  nextCharge: 'Prochain prélèvement',
  cancelBy: 'Résilier avant le',
  ended: 'Terminé',
  cancelledTo: 'Résilié pour le (facultatif)',
  cancelledToHint: 'Ensuite, plus aucun prélèvement ni délai.',
  cancelledBadge: (date: string) => `Résilié pour le ${date}`,
  priceHistory: 'Historique des prix',
  priceChange: (date: string, from: string, to: string, pct: number) =>
    `${date}: ${from} → ${to} (${pct > 0 ? '+' : ''}${pct} %)`,
  priceUp: (pct: number) => `Prix augmenté (+${pct} %)`,
  every: 'Intervalle',
  widgetEmpty: 'Aucun abonnement actif.',
  monthlyCost: (v: string) => `≙ ${v} par mois`,
};
