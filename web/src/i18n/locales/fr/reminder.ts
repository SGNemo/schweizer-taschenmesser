import type { Strings } from '@/strings';

export const reminder: Strings['reminder'] = {
  center: {
    title: 'Rappels',
    bell: (n: number) => (n === 0 ? 'Rappels' : `Rappels, ${n} en attente`),
    next: 'Rappel suivant',
    random: 'Rappel au hasard',
    another: 'Un autre',
    allRead: 'Tout lu',
    list: 'En attente',
    none: 'Aucun rappel en attente.',
    upcoming: (when: string) => `Ensuite : ${when}`,
    count: (n: number) => `${n} en attente`,
    doneAria: (title: string) => `${title} : terminé`,
    doneToast: 'Terminé.',
    allDoneToast: 'Tous marqués comme lus.',
  },
  label: 'Rappel',
  done: 'Terminé',
  later: 'Plus tard',
  open: 'Ouvrir',
  more: (n: number) => `+ ${n} de plus`,
  laterOptions: {
    '10min': 'Dans 10 min',
    '1h': 'Dans 1 h',
    evening: 'Ce soir',
    tomorrow: 'Demain matin',
    pc: 'Quand je suis sur le PC',
  },
  snoozed: {
    '10min': 'D’accord, dans 10 minutes.',
    '1h': 'D’accord, dans une heure.',
    evening: 'D’accord, ce soir.',
    tomorrow: 'D’accord, demain matin.',
    pc: 'D’accord, quand vous serez sur le PC.',
  },
};
