import type { Strings } from '@/strings';

export const reminder: Strings['reminder'] = {
  center: {
    title: 'Reminders',
    bell: (n: number) => (n === 0 ? 'Reminders' : `Reminders, ${n} open`),
    next: 'Next reminder',
    random: 'Random reminder',
    another: 'Another one',
    allRead: 'All read',
    list: 'Open',
    none: 'No open reminders.',
    upcoming: (when: string) => `Next: ${when}`,
    count: (n: number) => (n === 1 ? '1 open' : `${n} open`),
    doneAria: (title: string) => `${title}: done`,
    doneToast: 'Done.',
    allDoneToast: 'All marked as read.',
  },
  label: 'Reminder',
  done: 'Done',
  later: 'Later',
  open: 'Open',
  more: (n: number) => `+ ${n} more`,
  laterOptions: {
    '10min': 'In 10 min',
    '1h': 'In 1 hour',
    evening: 'This evening',
    tomorrow: 'Tomorrow morning',
    pc: 'When I’m at my PC',
  },
  snoozed: {
    '10min': 'Okay, in 10 minutes.',
    '1h': 'Okay, in an hour.',
    evening: 'Okay, this evening.',
    tomorrow: 'Okay, tomorrow morning.',
    pc: 'Okay, when you’re at your PC.',
  },
};
