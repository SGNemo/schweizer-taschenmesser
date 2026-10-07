import type { Strings } from '@/strings';

export const widgets: Strings['widgets'] = {
  done: 'Erledigt',
  undo: 'Rückgängig',
  now: 'Jetzt',
  next: 'Als Nächstes',
  allDay: 'Ganztägig',
  tomorrow: 'Morgen',
  more: (n: number) => `+ ${n} weitere`,
  invoicesSummary: (sum: string, overdue: number) =>
    overdue > 0 ? `${sum} offen · ${overdue} überfällig` : `${sum} offen`,
  subsSummary: (monthly: string, next?: string) =>
    next ? `${monthly} pro Monat · nächste ${next}` : `${monthly} pro Monat`,
  todosSummaryCalm: (open: number, waiting: number) =>
    (open === 1 ? '1 offen' : `${open} offen`) + (waiting > 0 ? ` · ${waiting} warten` : ''),
  todosSummary: (open: number, overdue: number) =>
    (open === 1 ? '1 offen' : `${open} offen`) + (overdue > 0 ? ` · ${overdue} überfällig` : ''),
  shoppingSummary: (open: number) => (open === 1 ? '1 Artikel offen' : `${open} Artikel offen`),
  budgetsSummary: (over: number) =>
    over === 0
      ? 'Alle Budgets im Rahmen'
      : over === 1
        ? '1 Budget überschritten'
        : `${over} Budgets überschritten`,
  packingSummary: (packed: number, total: number) => `${packed} von ${total} gepackt`,
  contractsSummary: (n: number) =>
    n === 1 ? '1 Kündigungsfrist in Sicht' : `${n} Kündigungsfristen in Sicht`,
  expirySummary: (expired: number, soon: number) =>
    [expired ? `${expired} abgelaufen` : '', soon ? `${soon} bald` : '']
      .filter(Boolean)
      .join(' · '),
  kpiAvailable: (amount: string) => `${amount} verfügbar`,
  kpiMonthNet: (amount: string) => `${amount} in diesem Monat`,
  kpiSeries: 'Kontostand am Monatsende, letzte 6 Monate',
};
