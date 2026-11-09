import { z } from 'zod';

const address = z.object({ name: z.string().optional(), email: z.string() });

/** What the cache keeps sealed per thread: sender, subject, preview (the parts that identify a mail). */
export const threadMetaSchema = z.object({
  from: address,
  subject: z.string(),
  snippet: z.string(),
  messageCount: z.number(),
  hasAttachment: z.boolean(),
  labelIds: z.array(z.string()),
  /** The sender is a person (derived from headers when the list was fetched; the headers are not kept). */
  personal: z.boolean().optional(),
});
export type ThreadMeta = z.output<typeof threadMetaSchema>;

/**
 * Cached thread header (device-local, never synced, never in a backup). Only sorting fields are in
 * the clear; sender, subject and preview are sealed with the device key (`cache.ts`). `demo` holds the
 * same fields in the clear for seed rows (invented mails for tests and screenshots).
 */
export const threadSchema = z.object({
  accountKey: z.string(),
  threadId: z.string(),
  /** Epoch ms of the newest message. */
  sortKey: z.number(),
  unread: z.boolean(),
  inbox: z.boolean(),
  sealed: z.string().optional(),
  demo: threadMetaSchema.optional(),
});
export type CachedThread = z.output<typeof threadSchema>;

/** A message that was opened: the whole parsed message, sealed. Bounded (oldest go first). */
export const bodySchema = z.object({
  accountKey: z.string(),
  messageId: z.string(),
  threadId: z.string(),
  /** Epoch ms of the last time it was opened (for the size limit). */
  sortKey: z.number(),
  sealed: z.string().optional(),
  demo: z
    .object({
      from: address,
      to: z.array(address),
      subject: z.string(),
      date: z.number(),
      text: z.string().optional(),
      html: z.string().optional(),
    })
    .optional(),
});
export type CachedBody = z.output<typeof bodySchema>;

export const LINK_TYPES = ['invoice', 'event', 'todo', 'reminder', 'bookmark', 'note'] as const;
/** A plan entry made from a mail is a ToDo (its first record): the link row says `todo`. */
export const linkTypeOf = (type: string): (typeof LINK_TYPES)[number] | undefined =>
  type === 'plan' ? 'todo' : LINK_TYPES.find((t) => t === type);

/**
 * "This entry was created from that mail": the way back from a thread to what came out of it (device-local,
 * like the cache). Only ids and the destination; the entry's title is read from the entry itself, so a
 * rename or a delete there is followed.
 */
export const linkSchema = z.object({
  accountKey: z.string(),
  threadId: z.string(),
  messageId: z.string(),
  type: z.enum(LINK_TYPES),
  moduleId: z.string(),
  collection: z.string(),
  entryId: z.string(),
});
export type MailLink = z.output<typeof linkSchema>;
