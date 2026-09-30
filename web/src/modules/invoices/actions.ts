import type { Stored } from '@/core/db/types';
import { bus } from '@/core/events';
import { today } from '@/core/time/dates';
import { invoiceRepo } from './repo';
import type { Invoice } from './schema';

async function announcePaid(invoice: Stored<Invoice>): Promise<void> {
  await bus.emit('invoice.paid', {
    invoiceId: invoice.id,
    payee: invoice.payee,
    amountMinor: invoice.amountMinor,
    paidAt: invoice.paidAt ?? today(),
    note: invoice.note,
  });
}

/** Marks an invoice as paid and tells other modules (finance books the expense). */
export async function markPaid(id: string, paidAt: string = today()): Promise<void> {
  const invoice = await invoiceRepo.update(id, { status: 'paid', paidAt });
  await announcePaid(invoice);
}

/** Reopens a paid invoice; finance removes the expense it booked. */
export async function markOpen(id: string): Promise<void> {
  await invoiceRepo.update(id, { status: 'open', paidAt: undefined });
  await bus.emit('invoice.unpaid', { invoiceId: id });
}

/** Saves edits. Editing a paid invoice re-announces it so the booked expense stays in sync. */
export async function saveInvoice(id: string | null, data: Invoice): Promise<void> {
  const saved = id ? await invoiceRepo.update(id, data) : await invoiceRepo.create(data);
  if (saved.status === 'paid') await announcePaid(saved);
}
