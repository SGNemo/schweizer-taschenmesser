import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const KINDS = ['contract', 'insurance', 'warranty'] as const;
export type ContractKind = (typeof KINDS)[number];

export const contractSchema = z
  .object({
    name: z.string().min(1),
    kind: z.enum(KINDS).default('contract'),
    provider: z.string().optional(),
    startDate: z.string().regex(DATE_RE).optional(),
    /** End of the term, or the end of the warranty. */
    endDate: z.string().regex(DATE_RE).optional(),
    /** Days before `endDate` by which the contract must be cancelled. */
    noticeDays: z.number().int().min(0).max(730).optional(),
    note: z.string().optional(),
  })
  .refine((c) => !c.startDate || !c.endDate || c.endDate >= c.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });

export type Contract = z.output<typeof contractSchema>;
