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
