import { z } from 'zod';

export const CATEGORIES = ['nachrichten', 'technik', 'wissenschaft', 'natur', 'sonstiges'] as const;
export type Category = (typeof CATEGORIES)[number];

export const feedSchema = z.object({
  /** http(s) address of the RSS/Atom feed. */
  url: z.string().min(8),
  title: z.string().min(1),
  category: z.enum(CATEGORIES).default('sonstiges'),
  active: z.boolean().default(true),
});

/** Cached article of a feed. Device-local: it is re-fetched, never synced or backed up. */
export const articleSchema = z.object({
  feedId: z.string().min(1),
  guid: z.string().min(1),
  title: z.string().min(1),
  teaser: z.string().default(''),
  url: z.string().optional(),
  /** Epoch ms. */
  publishedAt: z.number(),
  read: z.boolean().default(false),
  /** Sent to the bookmarks ("Für später"). */
  saved: z.boolean().default(false),
});

/** Fetch bookkeeping of one feed (validators for conditional requests, backoff). Device-local. */
export const feedStateSchema = z.object({
  etag: z.string().optional(),
  lastModified: z.string().optional(),
  /** Consecutive failures. */
  failures: z.number().int().default(0),
  /** Do not fetch before this epoch ms (backoff). */
  nextAt: z.number().default(0),
  lastOkAt: z.number().optional(),
  /** Code of the last failure (see `FetchFailure`). */
  lastError: z.string().optional(),
});

export type Feed = z.output<typeof feedSchema>;
export type Article = z.output<typeof articleSchema>;
export type FeedState = z.output<typeof feedStateSchema>;
