import type { Strings } from '@/strings';

export const invoices: Strings['invoices'] = {
  importDetail: (amount: string, due: string) => `${amount} · vence ${due}`,
  dueTitle: (payee: string) => `Fatura vence: ${payee}`,
  dueBody: (amount: string, date: string) => `${amount} · vence em ${date}`,
  meta: {
    name: 'Faturas',
    description:
      'Faturas em aberto com valor, destinatário e vencimento. “Marcar como paga” lança a despesa automaticamente em Finanças.',
    route: 'Faturas',
    widget: 'Faturas a vencer',
    quickAdd: 'Fatura',
    settings: {
      remindDaysBefore: 'Lembrete antes do vencimento (dias)',
      remindDaysBeforeHelp: '0 = no dia do vencimento',
      remindTime: 'Horário do lembrete',
      remindTimeHelp: 'Formato HH:mm',
    },
  },
  title: 'Faturas',
  add: 'Adicionar fatura',
  edit: 'Editar fatura',
  payee: 'Destinatário',
  reference: 'Descrição / número da fatura',
  dueDate: 'Vence em',
  paidAt: 'Paga em',
  open: 'Em aberto',
  paid: 'Paga',
  markPaid: 'Marcar como paga',
  markedPaid: 'Marcada como paga.',
  reopen: 'Reabrir',
  undo: 'Desfazer',
  empty: 'Nenhuma fatura em aberto.',
  emptyPaid: 'Ainda não há faturas pagas.',
  openTotal: 'Total em aberto',
  overdue: 'Atrasada',
  widgetEmpty: 'Nenhuma fatura em aberto.',
  openCount: (n: number) =>
    n === 0 || n === 1 ? `${n} fatura em aberto` : `${n} faturas em aberto`,
  view: 'Status',
};
