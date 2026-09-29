import { bus } from '@/core/events';
import {
  categoryRepo,
  ensureDefaults,
  INVOICE_CATEGORY_ID,
  primaryAccountId,
  transactionRepo,
} from './repo';

/** Transaction ids derived from invoice ids make bookings idempotent and convergent across devices. */
export const invoiceTransactionId = (invoiceId: string): string => `inv-${invoiceId}`;

/** Books (or updates) the expense for a paid invoice. */
export async function bookInvoiceExpense(p: {
  invoiceId: string;
  payee: string;
  amountMinor: number;
  paidAt: string;
  note?: string;
}): Promise<void> {
  await ensureDefaults();
  const id = invoiceTransactionId(p.invoiceId);
  const existing = await transactionRepo.table.get(id);
  if (existing) {
    if (existing.deletedAt !== null) await transactionRepo.restore(id);
    // Keep account and category the user may have changed; only sync what the invoice owns.
    await transactionRepo.update(id, {
      amountMinor: p.amountMinor,
      date: p.paidAt,
      payee: p.payee,
      note: p.note,
    });
    return;
  }
  const categoryId = (await categoryRepo.get(INVOICE_CATEGORY_ID))
    ? INVOICE_CATEGORY_ID
    : undefined;
  await transactionRepo.create(
    {
      accountId: await primaryAccountId(),
      categoryId,
      kind: 'expense',
      amountMinor: p.amountMinor,
      date: p.paidAt,
      payee: p.payee,
      note: p.note,
      sourceRef: `invoice:${p.invoiceId}`,
    },
    { id },
  );
}

/** Removes the expense of a reopened invoice. */
export async function removeInvoiceExpense(invoiceId: string): Promise<void> {
  const id = invoiceTransactionId(invoiceId);
  if (await transactionRepo.get(id)) await transactionRepo.remove(id);
}

/** Runs while the finance module is enabled: reacts to invoice events from the bus. */
export default function start(): () => void {
  const offPaid = bus.on('invoice.paid', (p) => bookInvoiceExpense(p));
  const offUnpaid = bus.on('invoice.unpaid', ({ invoiceId }) => removeInvoiceExpense(invoiceId));
  return () => {
    offPaid();
    offUnpaid();
  };
}
