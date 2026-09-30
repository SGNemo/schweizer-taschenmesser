/**
 * Read-only API for modules that are allowed to look at invoices (finance).
 * Everything else must use the event bus (`invoice.paid`, `invoice.unpaid`).
 */
import { sumMinor } from '@/core/money';
import { invoiceRepo } from './repo';

export interface OpenInvoice {
  id: string;
  payee: string;
  amountMinor: number;
  dueDate: string;
}

export async function listOpenInvoices(): Promise<OpenInvoice[]> {
  const all = await invoiceRepo.active().toArray();
  return all
    .filter((i) => i.status === 'open')
    .map(({ id, payee, amountMinor, dueDate }) => ({ id, payee, amountMinor, dueDate }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export async function sumOpenInvoices(): Promise<number> {
  return sumMinor((await listOpenInvoices()).map((i) => i.amountMinor));
}
