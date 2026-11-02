import type { SeedContext, SeedModule, SeedRows } from '@/core/seed/types';

/**
 * Test data for the Dev-Preview, E2E tests and screenshots. Invented addresses on reserved test
 * domains only; no real sites, no real browsing history.
 */
const PAGES = [
  { title: 'Beispiel-Wetter', url: 'https://wetter.example.org/' },
  { title: 'Beispiel-Zeitung', url: 'https://news.example.org/' },
  { title: 'Beispiel-Wörterbuch', url: 'https://woerter.example.org/' },
  { title: 'Beispiel-Fahrplan', url: 'https://fahrplan.example.org/' },
  { title: 'Beispiel-Rezepte', url: 'https://rezepte.example.org/' },
  { title: 'Beispiel-Wiki', url: 'https://wiki.example.org/' },
];

function seed(ctx: SeedContext): SeedRows {
  const marks = ctx.count({ small: 4, medium: 6, large: 6 });
  const visits = ctx.count({ small: 3, medium: 12, large: 200 });
  return {
    bookmark: PAGES.slice(0, marks).map((p, i) => ({
      id: ctx.id('browser', 'bookmark', i),
      data: p,
    })),
    history: Array.from({ length: visits }, (_, i) => {
      const p = PAGES[i % PAGES.length]!;
      return {
        id: ctx.id('browser', 'history', i),
        data: { title: p.title, url: i < PAGES.length ? p.url : `${p.url}seite-${i}` },
      };
    }),
    blockrule: [
      {
        id: ctx.id('browser', 'blockrule', 0),
        data: { kind: 'domain', value: 'ads.tracker.test' },
      },
    ],
  };
}

export default { seed } satisfies SeedModule;
