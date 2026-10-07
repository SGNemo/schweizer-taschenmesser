import type { Strings } from '@/strings';

export const people: Strings['people'] = {
  turnsAge: (name: string, age: number) => `${name} faz ${age} anos`,
  birthdayOf: (name: string) => `Aniversário: ${name}`,
  meta: {
    name: 'Pessoas',
    description:
      'Nunca mais esqueça aniversários e reúna presentes por pessoa: todo ano no calendário, com idade, lembrete e ideias de presente com preço, link e situação.',
    route: 'Pessoas',
    widget: 'Próximos aniversários',
    quickAdd: 'Pessoa',
    settings: {
      remindDaysBefore: 'Lembrete antes do aniversário (dias)',
      remindDaysBeforeHelp: '0 = no próprio dia',
      remindTime: 'Horário do lembrete',
      remindTimeHelp: 'Formato HH:mm',
    },
  },
  title: 'Pessoas',
  add: 'Adicionar pessoa',
  edit: 'Editar pessoa',
  name: 'Nome',
  hasBirthday: 'Informar aniversário',
  birthdayDate: 'Data de nascimento',
  yearUnknown: 'Ano de nascimento desconhecido',
  noBirthday: 'Sem aniversário',
  invalidDate: 'Informe uma data válida.',
  tags: 'Tags (separadas por vírgula)',
  note: 'Nota (opcional)',
  turns: (age: number) => `faz ${age} anos`,
  today: 'Hoje',
  inDays: (n: number) => (n === 0 || n === 1 ? `Em ${n} dia` : `Em ${n} dias`),
  congratulate: (name: string) => `Parabenizar ${name} pelo WhatsApp`,
  wish: (name: string) => `Feliz aniversário, ${name}! 🎂`,
  search: 'Buscar pessoas',
  empty: 'Ainda não há pessoas. Adicione aniversários e ideias de presente.',
  emptyFiltered: 'Nada encontrado.',
  back: 'Todas as pessoas',
  deleted: 'Pessoa excluída.',
  giftsOpen: (n: number) =>
    n === 0 || n === 1 ? `${n} presente pendente` : `${n} presentes pendentes`,
  giftsHeading: 'Presentes',
  giftsEmpty: 'Ainda não há ideias de presente para esta pessoa.',
  addGift: 'Adicionar ideia de presente',
  editGift: 'Editar ideia de presente',
  gift: {
    what: 'Ideia',
    occasion: 'Ocasião (opcional)',
    date: 'Data da ocasião (opcional)',
    price: 'Preço em € (opcional)',
    badPrice: (sample: string) => `Informe um valor como ${sample}.`,
    url: 'Link (opcional)',
    note: 'Nota (opcional)',
    status: 'Situação',
    statuses: { idea: 'Ideia', bought: 'Comprado', given: 'Dado' } as Record<string, string>,
    openLink: 'Abrir link',
    total: (n: number, sum: string) =>
      n === 0 || n === 1
        ? `${n} presente comprado ou dado por ${sum}`
        : `${n} presentes comprados ou dados por ${sum}`,
  },
  calendarGift: (who: string, what: string) => `Presente para ${who}: ${what}`,
  widgetEmpty: 'Ainda não há pessoas.',
  widgetAction: 'Adicionar pessoa',
  widgetSummary: (n: number) =>
    n === 0 || n === 1 ? `${n} presente pendente` : `${n} presentes pendentes`,
};
