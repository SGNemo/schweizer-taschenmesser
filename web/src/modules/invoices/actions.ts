import type { Stored } from '@/core/db/types';
import { bus } from '@/core/events';
import { today } from '@/core/time/dates';
import { nextDueDate } from './logic';
import { invoiceRepo } from './repo';
import type { Invoice } from './schema';

async function announcePaid(invoice: Stored<Invoice>): Promise<void> {
  await bus.emit('invoice.paid', {
    invoiceId: invoice.id,
    payee: invoice.payee,
    amountMinor: invoice.amountMinor,
    paidAt: invoice.paidAt ?? today(),
    note: invoice.note,
    ...(invoice.currency ? { currency: invoice.currency } : {}),
  });
}

/** Invoices created by `repeat` from `id` that are still open (nothing was done with them yet). */
async function openSuccessors(id: string): Promise<Stored<Invoice>[]> {
  return (await invoiceRepo.active().toArray()).filter(
    (i) => i.repeatOf === id && i.status === 'open',
  );
}

/**
 * A repeating invoice that was paid brings the next one: same payee, amount, reference and
 * repeat, due one period later, open. Paying again never creates a second one.
 */
async function createNext(invoice: Stored<Invoice>): Promise<void> {
  if (!invoice.repeat) return;
  const existing = (await invoiceRepo.active().toArray()).some((i) => i.repeatOf === invoice.id);
  if (existing) return;
  await invoiceRepo.create({
    payee: invoice.payee,
    amountMinor: invoice.amountMinor,
    ...(invoice.currency ? { currency: invoice.currency } : {}),
    dueDate: nextDueDate(invoice.dueDate, invoice.repeat),
    status: 'open',
    reference: invoice.reference,
    note: invoice.note,
    repeat: invoice.repeat,
    repeatOf: invoice.id,
  });
}

/** Marks an invoice as paid and tells other modules (finance books the expense). */
export async function markPaid(id: string, paidAt: string = today()): Promise<void> {
  const invoice = await invoiceRepo.update(id, { status: 'paid', paidAt });
  await announcePaid(invoice);
  await createNext(invoice);
}

/** Reopens a paid invoice; finance removes the expense it booked, and so does the next invoice it brought (while still open). */
export async function markOpen(id: string): Promise<void> {
  await invoiceRepo.update(id, { status: 'open', paidAt: undefined });
  await bus.emit('invoice.unpaid', { invoiceId: id });
  for (const next of await openSuccessors(id)) await invoiceRepo.remove(next.id);
}

/** Saves edits. Editing a paid invoice re-announces it so the booked expense stays in sync. */
export async function saveInvoice(id: string | null, data: Invoice): Promise<void> {
  const saved = id ? await invoiceRepo.update(id, data) : await invoiceRepo.create(data);
  if (saved.status === 'paid') await announcePaid(saved);
}
