import { z } from 'zod';

/** A subscribed feed (RSS, Atom or podcast): where it lives and how the person groups it. */
export const feedSchema = z.object({
  /** Name shown in the list; defaults to the host name when the person leaves it empty. */
  title: z.string().trim().min(1),
  /** The feed address; http(s) only. */
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'http(s) only'),
  /** Free group name ("Nachrichten", "Podcasts"); empty = ungrouped. */
  category: z.string().trim().default(''),
  /** The site the feed belongs to, when the source names one (OPML `htmlUrl`). */
  siteUrl: z.string().trim().optional(),
});

export type Feed = z.output<typeof feedSchema>;

/** Example item for the generic JSON import (`dataapi`), the widget tests and the docs. */
export const feedExample = {
  title: 'Beispiel-Blog',
  url: 'https://blog.example.org/feed.xml',
  category: 'Blogs',
};
