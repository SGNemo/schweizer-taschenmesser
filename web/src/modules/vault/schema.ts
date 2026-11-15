import { z } from 'zod';
import { DATE_RE } from '@/core/time/dates';

/**
 * The built-in categories. Their keys are also their ids in the `category` collection (the same on every
 * device, so two devices never create two "Verträge"): a record with such an id renames, recolours, moves or
 * removes the built-in one; without a record it shows with its translated name.
 */
export const CATEGORIES = [
  'identity',
  'insurance',
  'contract',
  'warranty',
  'tax',
  'health',
  'other',
] as const;
export type BuiltinCategory = (typeof CATEGORIES)[number];
/** A category id: a built-in key or the id of a category the user made (since version 4). */
export type DocCategory = string;
/** "Ohne Kategorie": fixed, never deleted, never renamed. A document whose category is gone counts here. */
export const NO_CATEGORY = 'other' satisfies BuiltinCategory;

/**
 * Metadata of a document ("Unterlagen"). The file itself lives in the local-only `_blobs` table
 * under the document id, so `fileName` on a device without the file only tells where it was added.
 * Contracts, insurances and warranties are documents with `startDate`/`endDate`/`noticeDays`.
 */
export const documentSchema = z
  .object({
    title: z.string().min(1),
    /** A category id (`CATEGORIES` or a record of the `category` collection); see `resolveCategory`. */
    category: z.string().min(1).default(NO_CATEGORY),
    provider: z.string().optional(),
    startDate: z.string().regex(DATE_RE).optional(),
    /** End of validity or of the term (passport, contract, warranty). */
    endDate: z.string().regex(DATE_RE).optional(),
    /** Days before `endDate` by which a contract must be cancelled. */
    noticeDays: z.number().int().min(0).max(730).optional(),
    /** Set when the period was entered in whole months (since version 3): the deadline moves by calendar months; `noticeDays` is then months × 30. */
    noticeMonths: z.number().int().min(1).max(24).optional(),
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

/** Icons a category can carry (all from `@/ui/icons`). */
export const CATEGORY_ICONS = [
  'files',
  'file',
  'lock',
  'receipt',
  'wallet',
  'home',
  'car',
  'heart',
  'calculator',
  'package',
  'luggage',
  'users',
  'umbrella',
] as const;
export type CategoryIcon = (typeof CATEGORY_ICONS)[number];

/**
 * A category of documents (since version 4). Built-in ones need no record; one is written only when the user
 * changes or removes it. Removing sets `removed` (never a tombstone): a built-in category must not come back
 * when a tombstone is cleaned up, and "Rückgängig" simply clears the flag.
 */
export const categorySchema = z.object({
  /** Empty on a built-in category that was never renamed: it keeps its translated name. */
  name: z.string().trim().max(60).optional(),
  /** Index into the fixed category palette (`categoryColor`); always shown together with the name. */
  tone: z.number().int().min(0).max(5).default(0),
  icon: z.enum(CATEGORY_ICONS).default('files'),
  order: z.number().default(0),
  removed: z.boolean().optional(),
});

export type DocumentCategory = z.output<typeof categorySchema>;
