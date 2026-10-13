import { bus } from '@/core/events';
import { today } from '@/core/time/dates';
import { undoableWithToast } from '@/core/undo/withToast';
import { t } from '@/strings';
import { planRepeats } from './logic';
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

/**
 * Books the next entries of repeating bookings (rent, salary) whose date has come. Runs when the
 * module starts; a toast says how many were added and offers "Rückgängig".
 */
export async function bookDueRepeats(): Promise<number> {
  const heads = (await transactionRepo.active().toArray()).filter((x) => x.repeat);
  const { create, clear } = planRepeats(heads, today());
  const fresh: typeof create = [];
  for (const p of create) if (!(await transactionRepo.table.get(p.id))) fresh.push(p);
  if (fresh.length === 0 && clear.length === 0) return 0;
  const message = t.finance.repeatBooked(fresh.length);
  const apply = async () => {
    for (const id of clear) await transactionRepo.update(id, { repeat: undefined });
    for (const p of fresh) await transactionRepo.create(p.data, { id: p.id });
  };
  if (fresh.length > 0) await undoableWithToast(message, message, apply);
  else await apply();
  return fresh.length;
}

/** Runs while the finance module is enabled: reacts to invoice events from the bus. */
export default function start(): () => void {
  void bookDueRepeats();
  const offPaid = bus.on('invoice.paid', (p) => bookInvoiceExpense(p));
  const offUnpaid = bus.on('invoice.unpaid', ({ invoiceId }) => removeInvoiceExpense(invoiceId));
  return () => {
    offPaid();
    offUnpaid();
  };
}
