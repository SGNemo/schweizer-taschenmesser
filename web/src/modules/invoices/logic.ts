import { sumMinor } from '@/core/money';
import { addMonthsStr } from '@/core/time/dates';
import type { Invoice, InvoiceRepeat } from './schema';

/** Open invoices by due date (oldest first), paid ones by payment date (newest first). */
export function sortInvoices<
  T extends Pick<Invoice, 'status' | 'dueDate' | 'paidAt'> & { createdAt: number },
>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'open' ? -1 : 1;
    if (a.status === 'open') return a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt;
    return (
      (b.paidAt ?? b.dueDate).localeCompare(a.paidAt ?? a.dueDate) || b.createdAt - a.createdAt
    );
  });
}

export const openTotal = (list: Pick<Invoice, 'status' | 'amountMinor'>[]): number =>
  sumMinor(list.filter((i) => i.status === 'open').map((i) => i.amountMinor));

const REPEAT_MONTHS: Record<InvoiceRepeat, number> = { monthly: 1, quarterly: 3, yearly: 12 };

/** Due date of the invoice that follows one due on `dueDate` (a 31st becomes the last day of a shorter month). */
export const nextDueDate = (dueDate: string, repeat: InvoiceRepeat): string =>
  addMonthsStr(dueDate, REPEAT_MONTHS[repeat]);
