import type { Strings } from '@/strings';

export const attention: Strings['attention'] = {
  title: 'Importante agora',
  hint: 'O que está atrasado, vence hoje ou está para vencer fica no topo.',
  invoicesOverdue: (n: number) =>
    n === 0 || n === 1 ? `${n} fatura atrasada` : `${n} faturas atrasadas`,
  invoicesToday: (n: number) =>
    n === 0 || n === 1 ? `${n} fatura vence hoje` : `${n} faturas vencem hoje`,
  subscriptionPrice: (name: string, from: string, to: string) =>
    `${name} agora custa ${to} em vez de ${from}`,
  subscriptionPriceSince: (date: string) => `Novo preço desde ${date}`,
  todosOverdue: (n: number) =>
    n === 0 || n === 1 ? `${n} tarefa atrasada` : `${n} tarefas atrasadas`,
  todosToday: (n: number) =>
    n === 0 || n === 1 ? `${n} tarefa vence hoje` : `${n} tarefas vencem hoje`,
  eventNext: (title: string) => title,
  eventAt: (time: string) => `hoje às ${time}`,
  budgetOver: (name: string) => `Orçamento “${name}” ultrapassado`,
  pantryExpired: (n: number) =>
    n === 0 || n === 1 ? `${n} item da despensa vencido` : `${n} itens da despensa vencidos`,
  pantryLow: (n: number) =>
    n === 1 ? '1 item da despensa acabando' : `${n} itens da despensa acabando`,
  pantrySoon: (n: number) =>
    n === 0 || n === 1
      ? `${n} item da despensa vence em breve`
      : `${n} itens da despensa vencem em breve`,
  docsExpired: (n: number) =>
    n === 0 || n === 1 ? `${n} documento vencido` : `${n} documentos vencidos`,
  docsSoon: (n: number) =>
    n === 0 || n === 1 ? `${n} documento vence em breve` : `${n} documentos vencem em breve`,
  contractsAct: (n: number) =>
    n === 0 || n === 1
      ? `${n} prazo de cancelamento termina em breve`
      : `${n} prazos de cancelamento terminam em breve`,
  driveFull: (name: string) => `Unidade ${name} quase cheia`,
  updateAvailable: 'Atualização disponível',
  waiting: (n: number) => `Ainda esperando · ${n}`,
  nothingNow: 'Nada disso precisa ser agora.',
  waitingExplain: 'Aberto há algum tempo, mas não urgente. Você pode replanejar.',
  todosWaiting: (n: number) =>
    n === 0 || n === 1 ? `${n} tarefa esperando` : `${n} tarefas esperando`,
  todosWaitingDetail: 'Dá para replanejar',
};
