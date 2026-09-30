import { sumMinor } from '@/core/money';
import type { Invoice } from './schema';

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
