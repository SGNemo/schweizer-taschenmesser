import { z } from 'zod';

/**
 * Everything the vault syncs is ciphertext. `header` is ONE field on purpose: field-level
 * last-write-wins must never mix the salt of one vault with the wrapped key of another.
 */
export const vaultSchema = z.object({ header: z.string().min(1) });

/** One field, too: an entry is replaced as a whole (newer edit wins), never merged field by field. */
export const entrySchema = z.object({ data: z.string().min(1) });

export const VAULT_RECORD_ID = 'vault';

export const totpSchema = z.object({
  /** Base32 secret. */
  secret: z.string().min(1),
  issuer: z.string().default(''),
  digits: z.union([z.literal(6), z.literal(7), z.literal(8)]).default(6),
  period: z.number().int().min(5).max(300).default(30),
  algorithm: z.enum(['SHA1', 'SHA256', 'SHA512']).default('SHA1'),
});
export type TotpConfig = z.output<typeof totpSchema>;

/** The plaintext of an entry – exists only in memory while the vault is unlocked. */
export const entryDataSchema = z.object({
  title: z.string().min(1),
  username: z.string().default(''),
  password: z.string().default(''),
  url: z.string().default(''),
  notes: z.string().default(''),
  tags: z.array(z.string()).default([]),
  totp: totpSchema.optional(),
  favorite: z.boolean().default(false),
});
export type EntryData = z.output<typeof entryDataSchema>;
export type EntryDraft = z.input<typeof entryDataSchema>;
