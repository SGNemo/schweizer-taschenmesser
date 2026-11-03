import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const ACCOUNT_KINDS = ['checking', 'savings', 'cash', 'card'] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export const BOOKING_REPEATS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;

export const accountSchema = z.object({
  name: z.string().min(1),
  /** Balance at the start; may be negative. Cents. */
  openingBalanceMinor: z.number().int().default(0),
  /** ISO 4217 code of the account and its bookings; none means euro (since version 3). */
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .optional()
    .meta({ description: 'ISO 4217, z. B. EUR, USD, MXN; ohne Angabe EUR' }),
  order: z.number().default(0),
  /** What the account is (since version 4); only changes the card and the order of the pickers. */
  kind: z.enum(ACCOUNT_KINDS).optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['expense', 'income']),
  /** One level of sub-categories (since version 4): the id of the parent of the same kind. */
  parentId: z.string().optional().meta({ internal: true }),
  /** Icon id from `categoryIcon.ts`; none derives it from the id or the name. */
  icon: z.string().optional().meta({ internal: true }),
});

/** One part of a split booking (a shop receipt with food and household goods). */
export const splitSchema = z.object({
  categoryId: z.string().optional(),
  amountMinor: z.number().int().min(1),
  note: z.string().optional(),
});

export const transactionSchema = z.object({
  accountId: z.string().min(1),
  categoryId: z.string().optional(),
  kind: z.enum(['expense', 'income']).meta({ description: 'expense = Ausgabe, income = Einnahme' }),
  /** Always positive; the kind decides the direction. Cents. */
  amountMinor: z.number().int().min(1),
  date: z.string().regex(DATE_RE),
  payee: z.string().optional(),
  note: z.string().optional(),
  /** Origin of automatically booked entries, e.g. "invoice:<id>". */
  sourceRef: z.string().optional().meta({ internal: true }),
  /** Repeating booking (rent, salary): the next one is created once its date has come. */
  repeat: z.enum(BOOKING_REPEATS).optional().meta({ internal: true }),
  /** First booking of a repeating series; gives the follow-ups stable ids across devices. */
  repeatOf: z.string().optional().meta({ internal: true }),
  /** Both halves of a transfer carry the same id; transfers are neither income nor expense. */
  transferId: z.string().optional().meta({ internal: true }),
  /** Parts of the amount per category; their sum is `amountMinor` (checked by `splitsValid`). */
  splits: z.array(splitSchema).max(20).optional().meta({ internal: true }),
});

export type Split = z.output<typeof splitSchema>;
export type BookingRepeat = (typeof BOOKING_REPEATS)[number];
export type Account = z.output<typeof accountSchema>;
export type Category = z.output<typeof categorySchema>;
export type Transaction = z.output<typeof transactionSchema>;
