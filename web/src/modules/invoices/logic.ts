import { formatTotals, sumByCurrency, sumMinor } from '@/core/money';
import { daysBetween } from '@/core/time/dates';
import { formatIban } from './iban';
import { addMonthsStr } from '@/core/time/dates';
import type { Invoice, InvoiceRepeat } from './schema';

type Money = Pick<Invoice, 'amountMinor' | 'payments'>;

/** Sum of the part payments. */
export const paidSum = (i: Pick<Invoice, 'payments'>): number =>
  sumMinor((i.payments ?? []).map((p) => p.amountMinor));

/** What is still to pay (never negative). */
export const remainingMinor = (i: Money): number => Math.max(0, i.amountMinor - paidSum(i));

/** Open invoices by due date (oldest first), paid ones by payment date (newest first). */
export function sortInvoices<
  T extends Pick<Invoice, 'status' | 'dueDate' | 'paidAt' | 'dunningLevel'> & {
    createdAt: number;
  },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (a.status === 'open')
      return (
        a.dueDate.localeCompare(b.dueDate) ||
        (b.dunningLevel ?? 0) - (a.dunningLevel ?? 0) ||
        a.createdAt - b.createdAt
      );
    return (
      (b.paidAt ?? b.dueDate).localeCompare(a.paidAt ?? a.dueDate) || b.createdAt - a.createdAt
    );
  });
}

/** What is still open over all open invoices: part payments are already deducted. */
export const openTotal = (list: (Pick<Invoice, 'status'> & Money)[]): number =>
  sumMinor(list.filter((i) => i.status === 'open').map(remainingMinor));

/** The open total as text, per currency when there is more than one ("120,00 € · 80,00 USD"). */
export const openTotalText = (list: (Pick<Invoice, 'status' | 'currency'> & Money)[]): string =>
  formatTotals(
    sumByCurrency(
      list
        .filter((i) => i.status === 'open')
        .map((i) => ({ ...i, amountMinor: remainingMinor(i) })),
    ),
  );

export type InvoiceStateKind = 'paid' | 'overdue' | 'partial' | 'open';

export interface InvoiceState {
  /** paid > overdue > partial > open; `partial` is also set on an overdue one that was partly paid. */
  kind: InvoiceStateKind;
  partial: boolean;
  restMinor: number;
  /** Whole days past the due date (0 when not overdue). */
  daysOverdue: number;
}

/** The state shown in the list. An invoice is overdue the day after its due date, not on it. */
export function invoiceState(
  i: Pick<Invoice, 'status' | 'dueDate' | 'payments'> & Money,
  day: string,
): InvoiceState {
  const restMinor = remainingMinor(i);
  const partial = i.status === 'open' && paidSum(i) > 0 && restMinor > 0;
  if (i.status === 'paid') return { kind: 'paid', partial: false, restMinor: 0, daysOverdue: 0 };
  const daysOverdue = i.dueDate < day ? daysBetween(i.dueDate, day) : 0;
  const kind: InvoiceStateKind = daysOverdue > 0 ? 'overdue' : partial ? 'partial' : 'open';
  return { kind, partial, restMinor, daysOverdue };
}

/** Whether the part payments cover the whole amount. */
export const fullyCovered = (i: Money): boolean => paidSum(i) >= i.amountMinor;

/** The payment details as one block for the banking app: payee, IBAN (grouped), reference, the amount still to pay. */
export function paymentBlock(
  i: Pick<Invoice, 'payee' | 'iban' | 'bic' | 'reference'>,
  amountText: string,
  labels: { recipient: string; iban: string; bic: string; reference: string; amount: string },
): string {
  return [
    `${labels.recipient}: ${i.payee}`,
    i.iban ? `${labels.iban}: ${formatIban(i.iban)}` : '',
    i.bic ? `${labels.bic}: ${i.bic.trim().toUpperCase()}` : '',
    i.reference ? `${labels.reference}: ${i.reference}` : '',
    `${labels.amount}: ${amountText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const REPEAT_MONTHS: Record<InvoiceRepeat, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Due date of the invoice that follows one due on `dueDate` (a 31st becomes the last day of a shorter month). */
export const nextDueDate = (dueDate: string, repeat: InvoiceRepeat): string =>
  addMonthsStr(dueDate, REPEAT_MONTHS[repeat]);
