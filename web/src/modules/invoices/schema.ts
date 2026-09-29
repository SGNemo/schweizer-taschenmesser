import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

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
});

export type Invoice = z.output<typeof invoiceSchema>;
