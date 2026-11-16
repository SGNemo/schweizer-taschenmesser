import { z } from 'zod';

/**
 * One card of the conversation with a paired device: a message, link or clipboard text, sent or
 * received. Device-local (`local: true`): never synced, never in a backup, never searched, never
 * offered to the assistant. Files never come here (package 2 keeps them on disk).
 */
export const itemSchema = z.object({
  /** The other device's key (hex). */
  peer: z.string().min(1).max(64),
  /** The item's id on the wire (32 hex digits): the same on both devices, dedupes a resend. */
  itemId: z.string().regex(/^[0-9a-f]{32}$/),
  direction: z.enum(['in', 'out']),
  kind: z.enum(['text', 'link', 'clip']),
  body: z.string().min(1).max(16_384),
  /**
   * `received` (in); out: `waiting` (not handed over yet), `sent` (handed over, no answer yet),
   * `delivered`, `full` (the other device had no room; tried again), `rejected` (it cannot take it).
   */
  state: z.enum(['received', 'waiting', 'sent', 'delivered', 'full', 'rejected']),
  /** Received and not looked at yet (the widget's „neu“); cleared when the page is open. */
  unseen: z.boolean().default(false),
});

export type ExchangeRow = z.output<typeof itemSchema>;
