import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const accountSchema = z.object({
  name: z.string().min(1),
  /** Balance at the start; may be negative. Cents. */
  openingBalanceMinor: z.number().int().default(0),
  order: z.number().default(0),
});

export const categorySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['expense', 'income']),
});

export const transactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().optional(),
  kind: z.enum(['expense', 'income']),
  /** Always positive; the kind decides the direction. Cents. */
  amountMinor: z.number().int().min(1),
  date: z.string().regex(DATE_RE),
  payee: z.string().optional(),
  note: z.string().optional(),
  /** Origin of automatically booked entries, e.g. "invoice:<id>". */
  sourceRef: z.string().optional(),
});

export type Account = z.output<typeof accountSchema>;
export type Category = z.output<typeof categorySchema>;
export type Transaction = z.output<typeof transactionSchema>;
