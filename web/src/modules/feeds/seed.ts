import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data for the Dev-Preview, E2E tests and screenshots (contract: docs/HOW-TO.md "Seed bauen").
 * Invented feeds on `example.org` only; pure and deterministic.
 */
const FEEDS = [
  ['Tagesbericht', 'tagesbericht.example.org/feed.xml', 'Nachrichten'],
  ['Wissenschaft kompakt', 'wissen.example.org/rss', 'Nachrichten'],
  ['Der Werkstatt-Podcast', 'werkstatt.example.org/podcast.rss', 'Podcasts'],
  ['Kochen am Sonntag', 'kochen.example.org/atom.xml', 'Podcasts'],
  ['Blog von Anna', 'anna.example.org/index.xml', ''],
  ['Lokalzeitung Musterstadt', 'musterstadt.example.org/rss.xml', 'Nachrichten'],
] as const;

function seed(ctx: SeedContext): SeedRows {
  const n = ctx.count({ small: 4, medium: 6, large: 60 });
  return {
    feed: Array.from({ length: n }, (_, i) => {
      const base = FEEDS[i % FEEDS.length]!;
      const round = Math.floor(i / FEEDS.length);
      return {
        id: ctx.id('feeds', 'feed', i),
        data: {
          title: round === 0 ? base[0] : `${base[0]} ${round + 1}`,
          url: `https://${base[1]}${round === 0 ? '' : `?n=${round + 1}`}`,
          category: base[2],
        },
      };
    }),
  };
}

export default { seed } satisfies SeedModule;
