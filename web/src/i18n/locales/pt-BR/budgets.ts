import type { Strings } from '@/strings';

export const budgets: Strings['budgets'] = {
  ext: {
    period: {
      label: 'Período',
      month: 'Mês',
      quarter: 'Trimestre',
      year: 'Ano',
      quarterLabel: (q: number, year: number) => `T${q} ${year}`,
      perPeriod: (period: string) => `por ${period}`,
    },
    carry: {
      label: 'Levar o resto para o próximo período',
      hint: 'O que sobra amplia o próximo orçamento; o que passou do limite o reduz (em no máximo um orçamento).',
      plus: (amount: string) => `incl. ${amount} transferidos`,
      minus: (amount: string) => `menos ${amount} transferidos`,
    },
    warn: {
      label: 'Avisar a partir de (porcentagem)',
      hint: 'Vazio = padrão das configurações.',
      title: (name: string, percent: number) => `${name}: ${percent}% do orçamento usado`,
    },
    forecast: {
      over: (amount: string) => `No ritmo atual: cerca de ${amount} acima do orçamento`,
    },
    history: {
      title: 'Histórico',
      period: 'Período',
      spent: 'Gasto',
      limit: 'Orçamento',
      bookings: 'Ver lançamentos',
    },
    head: {
      free: 'Ainda livre',
      context: (n: number, over: number) =>
        over === 0
          ? n === 1
            ? '1 orçamento, dentro do limite'
            : `${n} orçamentos, todos dentro do limite`
          : n === 1
            ? '1 orçamento, acima'
            : `${n} orçamentos, ${over} acima`,
      ring: (n: number) => `Distribuição dos gastos em ${n} orçamentos`,
    },
    goal: {
      rate: 'Valor mensal planejado',
      rateHint: 'Opcional: com o seu valor você vê quando a meta é alcançada.',
      start: 'Poupando desde',
      startHint: 'Opcional: com o início você vê quanto separa por mês, em média.',
      pace: (avg: string) => `Até agora você separa em média ${avg} por mês.`,
      paceReach: (date: string) => `No ritmo atual você alcança a meta em ${date}.`,
      plan: (rate: string, date: string) => `Com ${rate} por mês você chega à meta em ${date}.`,
      inTime: 'Isso combina com a data da meta.',
      late: (months: number) =>
        months === 1
          ? 'É 1 mês depois da data da meta.'
          : `São ${months} meses depois da data da meta.`,
    },
    widget: { addExpense: 'Despesa +' },
    settings: {
      warnAtPercent: 'Avisar a partir de (porcentagem do orçamento)',
      warnAtPercentHelp:
        'A partir dessa parte, um orçamento aparece como “quase esgotado”. Só o que ultrapassa o orçamento fica vermelho.',
      showForecast: 'Mostrar a previsão até o fim do período',
      showForecastHelp:
        'Uma linha por orçamento: onde os gastos terminam no ritmo atual, com os lançamentos recorrentes previstos.',
    },
  },
  meta: {
    name: 'Orçamentos e metas de economia',
    description:
      'Limites mensais por categoria de despesa (das Finanças) e metas de economia com depósitos e progresso.',
    route: 'Orçamentos',
    widget: 'Orçamentos e metas',
    quickAdd: 'Meta de economia',
  },
  title: 'Orçamentos e metas de economia',
  tabs: 'Área',
  tabBudgets: 'Orçamentos',
  tabGoals: 'Metas de economia',
  addBudget: 'Adicionar orçamento',
  editBudget: 'Editar orçamento',
  addGoal: 'Adicionar meta de economia',
  editGoal: 'Editar meta de economia',
  category: 'Categoria',
  unknownCategory: 'Categoria excluída',
  limit: 'Limite por mês',
  needFinance: 'Orçamentos precisam do módulo “Finanças”.',
  needFinanceHint: 'Ative-o na Biblioteca de módulos – as despesas por categoria vêm de lá.',
  prevMonth: 'Mês anterior',
  nextMonth: 'Próximo mês',
  emptyBudgets: 'Ainda não há orçamentos. Defina um limite mensal para uma categoria de despesa.',
  emptyGoals: 'Ainda não há metas de economia.',
  spentOf: (spent: string, limit: string) => `${spent} de ${limit}`,
  left: (amount: string) => `restam ${amount}`,
  over: (amount: string) => `${amount} acima`,
  goalName: 'Para que você está economizando?',
  target: 'Valor da meta',
  deadline: 'Até (opcional)',
  until: (date: string) => `até ${date}`,
  remaining: 'Falta',
  reached: 'Alcançada',
  perMonth: (amount: string) => `Até o prazo: guardar ${amount} por mês`,
  deposit: 'Depositar',
  depositTitle: (name: string) => `Depósito: ${name}`,
  depositIn: 'Depósito',
  depositOut: 'Retirada',
  kind: 'Tipo',
  history: 'Histórico',
  historyTitle: (name: string) => `Histórico: ${name}`,
  noDeposits: 'Ainda não há depósitos.',
  widgetEmpty: 'Nada para observar.',
};
