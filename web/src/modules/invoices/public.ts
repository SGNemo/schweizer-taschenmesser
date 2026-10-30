/**
 * Read-only API for modules that are allowed to look at invoices (finance).
 * Everything else must use the event bus (`invoice.paid`, `invoice.unpaid`).
 */
import { currencyOf, DEFAULT_CURRENCY, sumMinor } from '@/core/money';
import { invoiceRepo } from './repo';

export interface OpenInvoice {
  id: string;
  payee: string;
  amountMinor: number;
  currency: string;
  dueDate: string;
}

export async function listOpenInvoices(): Promise<OpenInvoice[]> {
  const all = await invoiceRepo.active().toArray();
  return all
    .filter((i) => i.status === 'open')
    .map(({ id, payee, amountMinor, dueDate, currency }) => ({
      id,
      payee,
      amountMinor,
      currency: currencyOf(currency),
      dueDate,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Open invoices in one currency (the euro by default); other currencies never count into it. */
export async function sumOpenInvoices(currency: string = DEFAULT_CURRENCY): Promise<number> {
  return sumMinor(
    (await listOpenInvoices()).filter((i) => i.currency === currency).map((i) => i.amountMinor),
  );
}
