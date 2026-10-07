import type { Strings } from '@/strings';

export const reminder: Strings['reminder'] = {
  center: {
    title: 'Erinnerungen',
    bell: (n: number) => (n === 0 ? 'Erinnerungen' : `Erinnerungen, ${n} offen`),
    next: 'Nächste Erinnerung',
    random: 'Zufällige Erinnerung',
    another: 'Noch eine',
    allRead: 'Alle gelesen',
    list: 'Offen',
    none: 'Keine offenen Erinnerungen.',
    upcoming: (when: string) => `Als Nächstes: ${when}`,
    count: (n: number) => (n === 1 ? '1 offen' : `${n} offen`),
    doneAria: (title: string) => `${title}: erledigt`,
    doneToast: 'Erledigt.',
    allDoneToast: 'Alle als gelesen markiert.',
  },
  label: 'Erinnerung',
  done: 'Erledigt',
  later: 'Später',
  open: 'Öffnen',
  more: (n: number) => (n === 1 ? '+ 1 weitere' : `+ ${n} weitere`),
  laterOptions: {
    '10min': 'In 10 Min',
    '1h': 'In 1 Std',
    evening: 'Heute Abend',
    tomorrow: 'Morgen früh',
    pc: 'Wenn ich am PC bin',
  },
  snoozed: {
    '10min': 'Okay, in 10 Minuten.',
    '1h': 'Okay, in einer Stunde.',
    evening: 'Okay, heute Abend.',
    tomorrow: 'Okay, morgen früh.',
    pc: 'Okay, wenn du am PC bist.',
  },
};
