import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

/** How often an invoice comes back; paying one creates the next (since version 2). */
export const INVOICE_REPEATS = ['monthly', 'quarterly', 'yearly'] as const;
export type InvoiceRepeat = (typeof INVOICE_REPEATS)[number];

export const invoiceSchema = z.object({
  payee: z.string().min(1),
  /** Positive amount in cents. */
  amountMinor: z.number().int().min(1),
  dueDate: z.string().regex(DATE_RE),
  status: z.enum(['open', 'paid']).default('open'),
  /** Set while status is "paid", 'YYYY-MM-DD'. */
  paidAt: z.string().regex(DATE_RE).optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
  /** Paying this invoice creates the next one that many months later. */
  repeat: z.enum(INVOICE_REPEATS).optional(),
  /** Set on an invoice that was created by `repeat`: the invoice it follows (internal, not part of the import format). */
  repeatOf: z.string().optional().meta({ internal: true }),
});

export type Invoice = z.output<typeof invoiceSchema>;
