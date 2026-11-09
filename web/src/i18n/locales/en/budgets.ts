import type { Strings } from '@/strings';

export const budgets: Strings['budgets'] = {
  ext: {
    period: {
      label: 'Period',
      month: 'Month',
      quarter: 'Quarter',
      year: 'Year',
      quarterLabel: (q: number, year: number) => `Q${q} ${year}`,
      perPeriod: (period: string) => `per ${period}`,
    },
    carry: {
      label: 'Carry the rest over to the next period',
      hint: 'What is left extends the next budget; what was overspent shrinks it (by one budget at most).',
      plus: (amount: string) => `incl. ${amount} carried over`,
      minus: (amount: string) => `less ${amount} carried over`,
    },
    warn: {
      label: 'Warn from (percent)',
      hint: 'Empty = default from the settings.',
      title: (name: string, percent: number) => `${name}: ${percent}% of the budget used`,
    },
    forecast: {
      over: (amount: string) => `At the pace so far: about ${amount} over the budget`,
    },
    history: {
      title: 'History',
      period: 'Period',
      spent: 'Spent',
      limit: 'Budget',
      bookings: 'View transactions',
    },
    head: {
      free: 'Still free',
      chip: (name: string, pct: number) => `${name} ${pct} %`,
      context: (n: number, over: number) =>
        over === 0
          ? n === 1
            ? '1 budget, within limit'
            : `${n} budgets, all within limit`
          : n === 1
            ? '1 budget, over'
            : `${n} budgets, ${over} over`,
      ring: (n: number) => `Spending across ${n} budgets`,
    },
    goal: {
      rate: 'Planned rate per month',
      rateHint: 'Optional: with your rate you see when the goal is reached.',
      start: 'Saving since',
      startHint: 'Optional: with the start you see how much you put aside per month on average.',
      pace: (avg: string) => `So far you put aside ${avg} a month on average.`,
      paceReach: (date: string) => `At the pace so far you reach the goal in ${date}.`,
      plan: (rate: string, date: string) => `At ${rate} a month you reach the goal in ${date}.`,
      inTime: 'That fits the target date.',
      late: (months: number) =>
        months === 1
          ? 'That is 1 month after the target date.'
          : `That is ${months} months after the target date.`,
    },
    widget: { addExpense: 'Expense +' },
    settings: {
      warnAtPercent: 'Warn from (percent of the budget)',
      warnAtPercentHelp:
        'From this share a budget shows “nearly used up”. Only what exceeds the budget turns red.',
      showForecast: 'Show the forecast to the end of the period',
      showForecastHelp:
        'One line per budget: where the spending ends up at the pace so far, including planned repeating bookings.',
    },
  },
  meta: {
    name: 'Budgets & savings goals',
    description:
      'Monthly limits per expense category (from Finances) and savings goals with deposits and progress.',
    route: 'Budgets',
    widget: 'Budgets & savings goals',
    quickAdd: 'Savings goal',
  },
  title: 'Budgets & savings goals',
  tabs: 'Section',
  tabBudgets: 'Budgets',
  tabGoals: 'Savings goals',
  addBudget: 'Add budget',
  editBudget: 'Edit budget',
  addGoal: 'Add savings goal',
  editGoal: 'Edit savings goal',
  category: 'Category',
  unknownCategory: 'Deleted category',
  limit: 'Limit per month',
  needFinance: 'Budgets need the “Finances” module.',
  needFinanceHint: 'Turn it on in the module library – the expenses per category come from there.',
  month: 'Month',
  prevMonth: 'Previous month',
  nextMonth: 'Next month',
  emptyBudgets: 'No budgets yet. Set a monthly limit for an expense category.',
  emptyGoals: 'No savings goals yet.',
  spentOf: (spent: string, limit: string) => `${spent} of ${limit}`,
  left: (amount: string) => `${amount} left`,
  over: (amount: string) => `${amount} over`,
  goalName: 'What are you saving for?',
  target: 'Target amount',
  deadline: 'By (optional)',
  until: (date: string) => `by ${date}`,
  remaining: 'Still to go',
  reached: 'Reached',
  perMonth: (amount: string) => `Until the deadline: put aside ${amount} per month`,
  deposit: 'Deposit',
  depositTitle: (name: string) => `Deposit: ${name}`,
  depositIn: 'Deposit',
  depositOut: 'Withdrawal',
  kind: 'Type',
  history: 'History',
  historyTitle: (name: string) => `History: ${name}`,
  noDeposits: 'No deposits yet.',
  widgetEmpty: 'Nothing to watch.',
};
