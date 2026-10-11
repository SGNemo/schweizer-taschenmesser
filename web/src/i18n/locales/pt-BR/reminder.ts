import type { Strings } from '@/strings';

export const reminder: Strings['reminder'] = {
  center: {
    title: 'Lembretes',
    bell: (n: number) => (n === 0 ? 'Lembretes' : `Lembretes, ${n} em aberto`),
    next: 'Próximo lembrete',
    random: 'Lembrete aleatório',
    another: 'Mais um',
    allRead: 'Todos lidos',
    list: 'Em aberto',
    none: 'Nenhum lembrete em aberto.',
    upcoming: (when: string) => `A seguir: ${when}`,
    count: (n: number) => `${n} em aberto`,
    doneAria: (title: string) => `${title}: concluído`,
    doneToast: 'Concluído.',
    allDoneToast: 'Todos marcados como lidos.',
  },
  label: 'Lembrete',
  done: 'Concluído',
  later: 'Depois',
  open: 'Abrir',
  more: (n: number) => `+ ${n} a mais`,
  laterOptions: {
    '10min': 'Em 10 min',
    '1h': 'Em 1 h',
    evening: 'Hoje à noite',
    tomorrow: 'Amanhã cedo',
    pc: 'Quando eu estiver no PC',
  },
  snoozed: {
    '10min': 'Certo, em 10 minutos.',
    '1h': 'Certo, em uma hora.',
    evening: 'Certo, hoje à noite.',
    tomorrow: 'Certo, amanhã cedo.',
    pc: 'Certo, quando você estiver no PC.',
  },
};
