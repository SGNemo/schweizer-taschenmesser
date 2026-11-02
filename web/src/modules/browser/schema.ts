import { z } from 'zod';

/** A saved page of the built-in browser. Device-local (see `repo.ts`). */
export const bookmarkSchema = z.object({
  title: z.string().min(1),
  /** http(s) address. */
  url: z.string().min(1),
});

/** One visited page; only written when the history setting is on and the tab is not private. */
export const historySchema = z.object({
  title: z.string(),
  url: z.string().min(1),
});

/** Something the user told the ad/tracker blocker to stop (same shape as Rust `Rule`). */
export const blockruleSchema = z.object({
  kind: z.enum(['domain', 'address']),
  value: z.string().min(1),
});

export type Bookmark = z.output<typeof bookmarkSchema>;
export type HistoryEntry = z.output<typeof historySchema>;
export type BlockRule = z.output<typeof blockruleSchema>;
