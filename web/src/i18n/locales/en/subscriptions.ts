import type { Strings } from '@/strings';

export const subscriptions: Strings['subscriptions'] = {
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
    },
  },
  title: 'Subscriptions',
  add: 'Add subscription',
  edit: 'Edit subscription',
  name: 'Name',
  firstCharge: 'Charge on',
  noticeDays: 'Notice period (days before the charge)',
  noticeHint: 'Leave empty if you can cancel any time.',
  active: 'Active',
  paused: 'Paused',
  empty: 'No subscriptions yet.',
  perMonth: 'Per month',
  perYear: 'Per year',
  nextCharge: 'Next charge',
  cancelBy: 'Cancel by',
  ended: 'Ended',
  every: 'Interval',
  widgetEmpty: 'No active subscriptions.',
  monthlyCost: (v: string) => `≙ ${v} per month`,
};
