import type { Strings } from '@/strings';

export const attention: Strings['attention'] = {
  title: 'Important now',
  hint: 'Overdue, due today and expiring things at the top.',
  invoicesOverdue: (n: number) => (n === 1 ? '1 invoice overdue' : `${n} invoices overdue`),
  invoicesToday: (n: number) => (n === 1 ? '1 invoice due today' : `${n} invoices due today`),
  todosOverdue: (n: number) => (n === 1 ? '1 to-do overdue' : `${n} to-dos overdue`),
  todosToday: (n: number) => (n === 1 ? '1 to-do due today' : `${n} to-dos due today`),
  eventNext: (title: string) => title,
  eventAt: (time: string) => `today at ${time}`,
  budgetOver: (name: string) => `Budget “${name}” exceeded`,
  pantryExpired: (n: number) => (n === 1 ? '1 pantry item expired' : `${n} pantry items expired`),
  pantrySoon: (n: number) =>
    n === 1 ? '1 pantry item expiring soon' : `${n} pantry items expiring soon`,
  docsExpired: (n: number) => (n === 1 ? '1 document expired' : `${n} documents expired`),
  docsSoon: (n: number) => (n === 1 ? '1 document expiring soon' : `${n} documents expiring soon`),
  contractsAct: (n: number) =>
    n === 1 ? '1 notice period ending soon' : `${n} notice periods ending soon`,
  driveFull: (name: string) => `Drive ${name} almost full`,
  updateAvailable: 'Update available',
  waiting: (n: number) => `Still waiting · ${n}`,
  nothingNow: 'None of this has to happen now.',
  todosWaiting: (n: number) => (n === 1 ? '1 to-do waiting' : `${n} to-dos waiting`),
  todosWaitingDetail: 'You can plan it again',
};
