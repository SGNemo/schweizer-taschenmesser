import type { SeedContext, SeedModule, SeedRows, SeedRow } from '@/core/seed/types';
import { articleId } from './logic';

type Category = 'nachrichten' | 'technik' | 'wissenschaft' | 'natur' | 'sonstiges';

const FEEDS: { title: string; slug: string; category: Category }[] = [
  { title: 'Tagesblick Regional', slug: 'tagesblick', category: 'nachrichten' },
  { title: 'Technik kompakt', slug: 'technik', category: 'technik' },
  { title: 'Forschung aktuell', slug: 'forschung', category: 'wissenschaft' },
  { title: 'Natur & Garten', slug: 'natur', category: 'natur' },
  { title: 'Wochenrückblick', slug: 'wochenrueckblick', category: 'sonstiges' },
  { title: 'Weltnachrichten kurz', slug: 'welt', category: 'nachrichten' },
  { title: 'Gadget-Notizen', slug: 'gadgets', category: 'technik' },
  { title: 'Weltraum-Report', slug: 'weltraum', category: 'wissenschaft' },
  { title: 'Wandern & Wetter', slug: 'wandern', category: 'natur' },
  { title: 'Kulturtipps', slug: 'kultur', category: 'sonstiges' },
];

const HEADLINES = [
  'Stadtrat beschließt neue Radwege im Zentrum',
  'Neue Akkutechnik hält doppelt so lange',
  'Forscher entdecken Pilzart in alten Wäldern',
  'Gartentipp: Was im Oktober noch gesät werden kann',
  'Bahnhof wird bis Frühjahr barrierefrei umgebaut',
  'Studie: Kurze Spaziergänge verbessern die Konzentration',
  'Winterzeit: Warum die Uhren bald umgestellt werden',
  'Kleines Sprachmodell läuft jetzt auf dem Handy',
  'Zugvögel ziehen früher als in den Vorjahren',
  'Neue Ausstellung zeigt Fotografie aus fünf Jahrzehnten',
  'Wochenmärkte erweitern ihr Angebot um Regionalprodukte',
  'Teleskop liefert scharfe Bilder ferner Galaxien',
];

const TEASERS = [
  'Die Bauarbeiten beginnen im November und sollen im März abgeschlossen sein.',
  'Erste Geräte mit dem neuen Verfahren kommen im kommenden Jahr auf den Markt.',
  'Das Team untersuchte über drei Jahre mehr als hundert Standorte.',
  'Mit ein paar einfachen Handgriffen bleibt der Garten auch im Winter gesund.',
  'Anwohner können sich bei einer Bürgerversammlung informieren.',
];

function seed(ctx: SeedContext): SeedRows {
  const feedCount = ctx.count({ small: 3, medium: 5, large: 10 });
  const perFeed = ctx.count({ small: 3, medium: 8, large: 30 });
  const feeds: SeedRow[] = [];
  const articles: SeedRow[] = [];
  const feedstate: SeedRow[] = [];
  for (let f = 0; f < feedCount; f++) {
    const src = FEEDS[f]!;
    const feedId = ctx.id('news', 'feed', f);
    feeds.push({
      id: feedId,
      data: {
        url: `https://news.example.org/${src.slug}/feed.xml`,
        title: src.title,
        category: src.category,
        // one inactive feed (when there are enough) so the toggle has a visible state
        active: f !== 4,
      },
    });
    // Looks freshly fetched and backed off: the background refresh skips it, so the fixture
    // articles stay untouched (the example.org feeds do not exist).
    feedstate.push({
      id: feedId,
      data: { failures: 0, nextAt: ctx.at(1, '12:00'), lastOkAt: ctx.at(0, '08:00') },
    });
    for (let a = 0; a < perFeed; a++) {
      const key = `${f}-${a}`;
      const guid = `seed-${src.slug}-${a}`;
      const title = HEADLINES[(f * 5 + a) % HEADLINES.length]!;
      articles.push({
        id: articleId(feedId, guid),
        data: {
          feedId,
          guid,
          title: a < HEADLINES.length ? title : `${title} (${a})`,
          teaser: TEASERS[(f + a) % TEASERS.length]!,
          url: `https://news.example.org/${src.slug}/artikel-${key}`,
          // newest first, spread over up to 25 days (retention is 30)
          publishedAt: ctx.at(-Math.floor((a * 25) / perFeed), a % 2 === 0 ? '07:30' : '18:15'),
          read: a % 3 === 1,
          saved: a % 7 === 5,
        },
      });
    }
  }
  return { feed: feeds, article: articles, feedstate };
}

export default { seed } satisfies SeedModule;
