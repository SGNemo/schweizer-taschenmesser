import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
  ext: {
    category: {
      label: 'Type of service',
      streaming: 'Streaming',
      music: 'Music',
      software: 'Software',
      cloud: 'Cloud & storage',
      news: 'News',
      mobility: 'Mobility',
      sport: 'Sport',
      insurance: 'Insurance',
      telecom: 'Phone & internet',
      other: 'Other',
    },
    trial: {
      label: 'Trial ends on',
      hint: 'You get a reminder beforehand.',
      chip: 'Trial',
      daysLeft: (n: number) =>
        n === 0 ? 'Trial ends today' : n === 1 ? 'Trial ends tomorrow' : `Trial ends in ${n} days`,
      reminderTitle: (name: string) => `Trial ends soon: ${name}`,
      reminderBody: (date: string, price: string) => `Until ${date}. Then ${price}.`,
      calendar: (name: string) => `Trial ends: ${name}`,
      remindDaysBefore: 'Reminder before the trial ends (days)',
      remindDaysBeforeHelp: '0 = on the last day of the trial',
    },
    status: { ended: 'Ended' },
    payment: { label: 'Paid with', placeholder: 'e.g. direct debit checking account' },
    monthlyShort: (amount: string) => `${amount} / month`,
    top: { title: 'Most expensive', perYear: (amount: string) => `${amount} a year` },
    head: {
      context: (n: number, soon: number) => {
        const count = n === 1 ? '1 subscription' : `${n} subscriptions`;
        return soon > 0
          ? `${soon === 1 ? '1 notice period ends soon' : `${soon} notice periods end soon`} · ${count}`
          : count;
      },
      alsoMonthly: 'plus per month',
      unit: '/ month',
      paused: (n: number) => `${n} paused`,
    },
    overview: {
      tab: 'Overview',
      listTab: 'Subscriptions',
      tabsLabel: 'View',
      sharesTitle: 'What you pay for',
      sharesByCategory: 'Cost per month by type',
      sharesByProvider: 'Cost per month by subscription',
      byLabel: 'Split by',
      byCategory: 'Type',
      byProvider: 'Subscription',
      noCategory: 'No type',
      perMonth: 'per month',
      nothingRunning: 'No subscription is running right now.',
      otherCurrencies: (n: number) =>
        n === 1
          ? '1 subscription in another currency is not included.'
          : `${n} subscriptions in other currencies are not included.`,
      upcomingTitle: 'Next 30 days',
      upcomingEmpty: 'Nothing is charged in the next 30 days.',
      upcomingSum: (n: number) => (n === 1 ? '1 charge, in total' : `${n} charges, in total`),
      yearTitle: 'What does it cost me per year',
      moreInYear: (n: number, amount: string) =>
        n === 1
          ? `Plus 1 more subscription: ${amount}`
          : `Plus ${n} more subscriptions: ${amount} in total`,
    },
    sort: {
      label: 'Sort by',
      next: 'Date',
      cost: 'Cost',
      name: 'Name',
    },
    perYearShort: (amount: string) => `${amount} a year`,
    deadlines: {
      title: 'Notice periods',
      none: 'No notice period ends in the next 90 days.',
      by: (date: string) => `Cancel by ${date}`,
      otherwise: (amount: string, date: string) => `otherwise ${amount} on ${date}`,
      plan: 'Add to plan',
      planFor: (name: string) => `Cancel ${name}: add to plan`,
      planned: 'In the plan',
    },
    prices: {
      title: 'Price changes',
      change: (from: string, to: string, pct: number) =>
        `${from} → ${to} (${pct > 0 ? '+' : ''}${pct} %)`,
      since: (date: string) => `since ${date}`,
      perYear: (amount: string, up: boolean) =>
        up ? `${amount} more per year` : `${amount} less per year`,
    },
    unused: {
      title: 'Hardly used',
      mark: 'Hardly used',
      markHint: 'The overview then shows what it costs per year.',
      menuMark: 'Mark as hardly used',
      menuUnmark: 'In use again',
      sum: (n: number, amount: string) =>
        n === 1
          ? `1 subscription, ${amount} per year`
          : `${n} subscriptions, ${amount} per year in total`,
    },
    widgetSummary: (monthly: string, name: string, date: string) =>
      `${monthly} per month · next: ${name}, ${date}`,
    suggest: {
      apply: (amount: string) => `Take over the price: ${amount}`,
      seen: (amount: string) => `Last charged: ${amount}`,
    },
  },
  importDetail: (amount: string, rhythm: string, next: string) =>
    `${amount} · ${rhythm} · next charge ${next}`,
  cancelTitle: (name: string) => `Notice period ends: ${name}`,
  cancelBody: (last: string, amount: string, charge: string) =>
    `Last day: ${last} – otherwise ${amount} on ${charge}`,
  cancelCalendar: (name: string) => `Notice period: ${name}`,
  meta: {
    name: 'Subscriptions',
    description:
      'Subscriptions and recurring payments: next charge, notice period and the total per month and year.',
    route: 'Subscriptions',
    widget: 'Upcoming charges',
    quickAdd: 'Subscription',
    settings: {
      cancelRemindDaysBefore: 'Reminder before the notice period ends (days)',
      cancelRemindDaysBeforeHelp: '0 = on the last day of the notice period',
      remindTime: 'Reminder time',
      remindTimeHelp: 'Format HH:mm',
      showInPlan: 'Show in the plan',
      showInPlanHelp:
        'Cancellation deadlines appear in the planner as “Cancel <subscription>”, the end of a trial as “<subscription>: trial ends” (15 min, by the last day of the deadline). Cancelling happens here. Only with the planner on.',
      priceHint: 'Notice when a price goes up',
      priceHintHelp:
        'Shows once under “Important now” when a subscription got more expensive. You can switch it off at any time.',
    },
  },
  title: 'Subscriptions',
  add: 'Add subscription',
  edit: 'Edit subscription',
  name: 'Name',
  planTitle: (name: string) => `Cancel ${name}`,
  planTrialTitle: (name: string) => `${name}: trial ends`,
  planAction: 'Cancel …',
  firstCharge: 'Charge on',
  noticeDays: 'Notice period (days before the charge)',
  noticeHint: 'Leave empty if you can cancel any time.',
  active: 'Active',
  paused: 'Paused',
  pause: 'Pause',
  resume: 'Resume',
  empty: 'No subscriptions yet.',
  emptyAction: 'Add your first subscription',
  perMonth: 'Per month',
  perYear: 'Per year',
  nextCharge: 'Next charge',
  cancelBy: 'Cancel by',
  ended: 'Ended',
  cancelledTo: 'Cancelled for (optional)',
  cancelledToHint: 'After that there are no more charges or deadlines.',
  cancelledBadge: (date: string) => `Cancelled for ${date}`,
  priceHistory: 'Price history',
  priceChange: (date: string, from: string, to: string, pct: number) =>
    `${date}: ${from} → ${to} (${pct > 0 ? '+' : ''}${pct} %)`,
  priceUp: (pct: number) => `Price raised (+${pct} %)`,
  every: 'Interval',
  widgetEmpty: 'No active subscriptions.',
  monthlyCost: (v: string) => `≙ ${v} per month`,
};
