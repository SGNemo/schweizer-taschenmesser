import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

/** How often an invoice comes back; paying one creates the next (since version 2). */
export const INVOICE_REPEATS = ['monthly', 'quarterly', 'yearly'] as const;
export type InvoiceRepeat = (typeof INVOICE_REPEATS)[number];

/** A part of the amount that was paid (since version 4). */
export const paymentSchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(DATE_RE),
  amountMinor: z.number().int().min(1),
});

/** The file of an invoice (PDF or photo) lives in the device-local blob store under `invoices:<id>`; only this note is synced. */
export const attachmentSchema = z.object({
  name: z.string().min(1),
  mime: z.string(),
  size: z.number().int().min(0),
});

export const invoiceSchema = z.object({
  payee: z.string().min(1),
  /** Positive amount in cents. */
  amountMinor: z.number().int().min(1),
  /** ISO 4217 code of the amount; none means euro (since version 3). */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .meta({ description: 'ISO 4217, z. B. EUR, USD, MXN; ohne Angabe EUR' }),
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
  /** Part payments; the invoice stays "open" with the rest until the parts add up (or "paid" is chosen). */
  payments: z.array(paymentSchema).max(60).optional().meta({ internal: true }),
  /** Reminder level 0–3 (0 = none) and the day it was sent or received. */
  dunningLevel: z.number().int().min(0).max(3).optional(),
  dunnedAt: z.string().regex(DATE_RE).optional(),
  /** Payee's account for the transfer, taken from the invoice. */
  iban: z.string().max(42).optional(),
  bic: z.string().max(11).optional(),
  attachment: attachmentSchema.optional().meta({ internal: true }),
});

export type Invoice = z.output<typeof invoiceSchema>;
export type Payment = z.output<typeof paymentSchema>;
