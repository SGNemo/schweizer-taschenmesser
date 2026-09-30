import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

export const CATEGORIES = ['identity', 'insurance', 'contract', 'tax', 'health', 'other'] as const;
export type DocCategory = (typeof CATEGORIES)[number];

/**
 * Metadata of a document. The file itself lives in the local-only `_blobs` table under the
 * document id, so `fileName` on a device without the file only tells where it was added.
 */
export const documentSchema = z.object({
  title: z.string().min(1),
  category: z.enum(CATEGORIES).default('other'),
  note: z.string().optional(),
  /** E.g. passport or ID card validity. */
  expiresOn: z.string().regex(DATE_RE).optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileSize: z.number().int().min(0).optional(),
});

export type VaultDocument = z.output<typeof documentSchema>;
