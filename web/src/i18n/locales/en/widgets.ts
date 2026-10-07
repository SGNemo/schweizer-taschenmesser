import type { Strings } from '@/strings';

export const widgets: Strings['widgets'] = {
  done: 'Done',
  undo: 'Undo',
  now: 'Now',
  next: 'Next',
  allDay: 'All day',
  tomorrow: 'Tomorrow',
  more: (n: number) => `+ ${n} more`,
  invoicesSummary: (sum: string, overdue: number) =>
    overdue > 0 ? `${sum} open · ${overdue} overdue` : `${sum} open`,
  subsSummary: (monthly: string, next?: string) =>
    next ? `${monthly} per month · next ${next}` : `${monthly} per month`,
  todosSummaryCalm: (open: number, waiting: number) =>
    (open === 1 ? '1 open' : `${open} open`) + (waiting > 0 ? ` · ${waiting} waiting` : ''),
  todosSummary: (open: number, overdue: number) =>
    (open === 1 ? '1 open' : `${open} open`) + (overdue > 0 ? ` · ${overdue} overdue` : ''),
  shoppingSummary: (open: number) => (open === 1 ? '1 item open' : `${open} items open`),
  budgetsSummary: (over: number) =>
    over === 0
      ? 'All budgets on track'
      : over === 1
        ? '1 budget exceeded'
        : `${over} budgets exceeded`,
  packingSummary: (packed: number, total: number) => `${packed} of ${total} packed`,
  contractsSummary: (n: number) =>
    n === 1 ? '1 notice period coming up' : `${n} notice periods coming up`,
  expirySummary: (expired: number, soon: number) =>
    [expired ? `${expired} expired` : '', soon ? `${soon} soon` : ''].filter(Boolean).join(' · '),
  kpiAvailable: (amount: string) => `${amount} available`,
  kpiMonthNet: (amount: string) => `${amount} this month`,
  kpiSeries: 'Balance at month end, last 6 months',
};
