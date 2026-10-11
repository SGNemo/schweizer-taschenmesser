import type { Strings } from '@/strings';

export const widgets: Strings['widgets'] = {
  done: 'Concluído',
  undo: 'Desfazer',
  now: 'Agora',
  next: 'A seguir',
  allDay: 'Dia inteiro',
  tomorrow: 'Amanhã',
  more: (n: number) => `+ ${n} a mais`,
  invoicesSummary: (sum: string, overdue: number) =>
    overdue > 0
      ? `${sum} em aberto · ${overdue} ${overdue === 1 ? 'atrasada' : 'atrasadas'}`
      : `${sum} em aberto`,
  subsSummary: (monthly: string, next?: string) =>
    next ? `${monthly} por mês · próxima ${next}` : `${monthly} por mês`,
  todosSummaryCalm: (open: number, waiting: number) =>
    (open === 0 || open === 1 ? `${open} aberta` : `${open} abertas`) +
    (waiting > 0 ? ` · ${waiting} esperando` : ''),
  todosSummary: (open: number, overdue: number) =>
    (open === 0 || open === 1 ? `${open} aberta` : `${open} abertas`) +
    (overdue > 0 ? ` · ${overdue} ${overdue === 1 ? 'atrasada' : 'atrasadas'}` : ''),
  shoppingSummary: (open: number) =>
    open === 0 || open === 1 ? `${open} item pendente` : `${open} itens pendentes`,
  budgetsSummary: (over: number) =>
    over === 0
      ? 'Todos os orçamentos dentro do limite'
      : over === 1
        ? '1 orçamento ultrapassado'
        : `${over} orçamentos ultrapassados`,
  packingSummary: (packed: number, total: number) => `${packed} de ${total} na mala`,
  contractsSummary: (n: number) =>
    n === 0 || n === 1
      ? `${n} prazo de cancelamento à vista`
      : `${n} prazos de cancelamento à vista`,
  expirySummary: (expired: number, soon: number) =>
    [
      expired ? `${expired} ${expired === 1 ? 'vencido' : 'vencidos'}` : '',
      soon ? `${soon} em breve` : '',
    ]
      .filter(Boolean)
      .join(' · '),
  kpiAvailable: (amount: string) => `${amount} disponível`,
  kpiMonthNet: (amount: string) => `${amount} neste mês`,
  kpiSeries: 'Saldo no fim do mês, últimos 6 meses',
};
