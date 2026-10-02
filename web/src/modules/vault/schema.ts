import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const CATEGORIES = [
  'identity',
  'insurance',
  'contract',
  'warranty',
  'tax',
  'health',
  'other',
] as const;
export type DocCategory = (typeof CATEGORIES)[number];

/**
 * Metadata of a document ("Unterlagen"). The file itself lives in the local-only `_blobs` table
 * under the document id, so `fileName` on a device without the file only tells where it was added.
 * Contracts, insurances and warranties are documents with `startDate`/`endDate`/`noticeDays`.
 */
export const documentSchema = z
  .object({
    title: z.string().min(1),
    category: z.enum(CATEGORIES).default('other'),
    provider: z.string().optional(),
    startDate: z.string().regex(DATE_RE).optional(),
    /** End of validity or of the term (passport, contract, warranty). */
    endDate: z.string().regex(DATE_RE).optional(),
    /** Days before `endDate` by which a contract must be cancelled. */
    noticeDays: z.number().int().min(0).max(730).optional(),
    note: z.string().optional(),
    /** Before 0.6.0 the end date; still read (`endOf`), never written. */
    expiresOn: z.string().regex(DATE_RE).optional(),
    fileName: z.string().optional(),
    fileType: z.string().optional(),
    fileSize: z.number().int().min(0).optional(),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    message: 'endDate must not be before startDate',
    path: ['endDate'],
  });

export type VaultDocument = z.output<typeof documentSchema>;
