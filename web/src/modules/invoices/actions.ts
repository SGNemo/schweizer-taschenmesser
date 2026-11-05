import { changedFields } from '@/core/db/patch';
import type { Stored } from '@/core/db/types';
import { bus } from '@/core/events';
import { today } from '@/core/time/dates';
import { randomId } from '@/core/db/util';
import { fullyCovered, nextDueDate, remainingMinor } from './logic';
import { invoiceRepo } from './repo';
import type { Invoice } from './schema';

async function announcePaid(invoice: Stored<Invoice>): Promise<void> {
  await bus.emit('invoice.paid', {
    invoiceId: invoice.id,
    payee: invoice.payee,
    // Part payments were announced (and booked) on their own: this carries what was still open.
    amountMinor: remainingMinor(invoice),
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
    // The bank details stay for the next one; payments, reminder level and the file belong to this one.
    ...(invoice.iban ? { iban: invoice.iban } : {}),
    ...(invoice.bic ? { bic: invoice.bic } : {}),
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

/**
 * Creates or changes an invoice. `base` is the record as the editor opened it: only the fields that
 * differ from it are written, so a change made meanwhile elsewhere is kept. Editing a paid invoice
 * re-announces it so the booked expense stays in sync.
 */
export async function saveInvoice(
  id: string | null,
  data: Invoice,
  base?: Invoice,
): Promise<Stored<Invoice>> {
  const patch = base ? changedFields(base, data) : data;
  const saved = id ? await invoiceRepo.update(id, patch) : await invoiceRepo.create(data);
  if (saved.status === 'paid') await announcePaid(saved);
  return saved;
}

/**
 * Records a part payment (capped at what is still open) and tells finance to book it. The payment
 * that covers the rest marks the invoice as paid (and creates the next one of a repeating invoice).
 */
export async function addPayment(
  id: string,
  amountMinor: number,
  date: string = today(),
): Promise<{ id: string; amountMinor: number } | undefined> {
  const invoice = await invoiceRepo.get(id);
  if (!invoice || invoice.status !== 'open') return undefined;
  const amount = Math.min(amountMinor, remainingMinor(invoice));
  if (amount < 1) return undefined;
  const payment = { id: randomId(), date, amountMinor: amount };
  const updated = await invoiceRepo.update(id, {
    payments: [...(invoice.payments ?? []), payment],
  });
  await bus.emit('invoice.payment', {
    invoiceId: id,
    paymentId: payment.id,
    payee: invoice.payee,
    amountMinor: amount,
    date,
    note: invoice.note,
    ...(invoice.currency ? { currency: invoice.currency } : {}),
  });
  if (fullyCovered(updated)) await markPaid(id, date);
  return payment;
}

/** Removes a part payment again (finance removes its booking); a paid invoice becomes open. */
export async function removePayment(id: string, paymentId: string): Promise<void> {
  const invoice = await invoiceRepo.get(id);
  if (!invoice) return;
  const payments = (invoice.payments ?? []).filter((p) => p.id !== paymentId);
  if (payments.length === (invoice.payments ?? []).length) return;
  await invoiceRepo.update(id, { payments: payments.length ? payments : undefined });
  await bus.emit('invoice.paymentRemoved', { invoiceId: id, paymentId });
  if (invoice.status === 'paid') await markOpen(id);
}
