/**
 * Read-only API for modules that are allowed to look at invoices (finance).
 * Everything else must use the event bus (`invoice.paid`, `invoice.unpaid`).
 */
import { currencyOf, DEFAULT_CURRENCY, sumMinor } from '@/core/money';
import { getSettings } from '@/core/settings/settings';
import { remainingMinor } from './logic';
import { invoiceRepo } from './repo';
import { settings } from './settings';

export interface OpenInvoice {
  id: string;
  payee: string;
  /** The part still to pay. */
  amountMinor: number;
  currency: string;
  dueDate: string;
}

export async function listOpenInvoices(): Promise<OpenInvoice[]> {
  const all = await invoiceRepo.active().toArray();
  return (
    all
      .filter((i) => i.status === 'open')
      // What is still to pay: part payments are booked already and must not count twice.
      .map((i) => ({
        id: i.id,
        payee: i.payee,
        amountMinor: remainingMinor(i),
        currency: currencyOf(i.currency),
        dueDate: i.dueDate,
      }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  );
}

/** Open invoices in one currency (the euro by default); other currencies never count into it. */
export async function sumOpenInvoices(currency: string = DEFAULT_CURRENCY): Promise<number> {
  return sumMinor(
    (await listOpenInvoices()).filter((i) => i.currency === currency).map((i) => i.amountMinor),
  );
}

/** Does the user want a paid invoice booked as an expense (Rechnungen → Einstellungen)? */
export async function paidInvoiceBookingOn(): Promise<boolean> {
  return (
    (await getSettings('module.invoices', settings.schema, settings.defaults)).bookWhenPaid !==
    false
  );
}

/** A payment of an invoice that finance books as an expense (a part payment, or what was left when it was marked paid). */
export interface InvoicePayment {
  invoiceId: string;
  /** Set for a part payment; empty for the rest that was paid when the invoice was marked paid. */
  paymentId?: string;
  payee: string;
  amountMinor: number;
  /** Day of the payment (`YYYY-MM-DD`). */
  paidAt: string;
  note?: string;
  currency?: string;
}

/**
 * Every payment finance should have booked: the part payments of live invoices, and for paid
 * invoices what was still open at that moment. Finance compares this with its bookings and books
 * what is missing (an event that was lost when the app closed in between).
 */
export async function listInvoicePayments(): Promise<InvoicePayment[]> {
  const out: InvoicePayment[] = [];
  for (const i of await invoiceRepo.active().toArray()) {
    for (const p of i.payments ?? [])
      out.push({
        invoiceId: i.id,
        paymentId: p.id,
        payee: i.payee,
        amountMinor: p.amountMinor,
        paidAt: p.date,
        note: i.note,
        ...(i.currency ? { currency: i.currency } : {}),
      });
    const rest = remainingMinor(i);
    if (i.status === 'paid' && i.paidAt && rest >= 1)
      out.push({
        invoiceId: i.id,
        payee: i.payee,
        amountMinor: rest,
        paidAt: i.paidAt,
        note: i.note,
        ...(i.currency ? { currency: i.currency } : {}),
      });
  }
  return out;
}
