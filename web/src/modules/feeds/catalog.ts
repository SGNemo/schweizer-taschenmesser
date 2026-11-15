import data from './catalog.json';
import { feedKey, hostOf } from './logic';

/** The six groups of the starter catalogue, in the order the add dialog shows them. */
export const CATALOG_CATEGORIES = ['news', 'tech', 'science', 'sport', 'gaming', 'local'] as const;
export type CatalogCategory = (typeof CATALOG_CATEGORIES)[number];

/** Languages the catalogue has sources for; every other app language browses the English list. */
export type CatalogLang = 'de' | 'en';

/** One curated source: a public feed without tracking parameters (provenance: `docs/design/feeds-deep/SOURCES.md`). */
export interface CatalogEntry {
  id: string;
  lang: CatalogLang;
  category: CatalogCategory;
  /** The source's own name (a proper name, not UI text). */
  title: string;
  /** The feed address. */
  url: string;
  /** The site the feed belongs to. */
  site: string;
  /** Region of a local source, in the source's language. */
  region?: string;
}

export const CATALOG: readonly CatalogEntry[] = data as CatalogEntry[];

export const catalogLang = (lang: string): CatalogLang => (lang === 'de' ? 'de' : 'en');

/** Lower case without accents, so "osterreich" finds "Österreich". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * Entries whose name, site, region or group name contain every word of `query`. An empty query keeps
 * the language's whole list; a search looks at both languages, the chosen one first.
 */
export function searchCatalog(
  query: string,
  lang: CatalogLang,
  categoryLabel: (c: CatalogCategory) => string,
  entries: readonly CatalogEntry[] = CATALOG,
): CatalogEntry[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return entries.filter((e) => e.lang === lang);
  const hits = entries.filter((e) => {
    const hay = fold(
      [e.title, hostOf(e.url), hostOf(e.site), e.region ?? '', categoryLabel(e.category)].join(' '),
    );
    return words.every((w) => hay.includes(w));
  });
  return [...hits.filter((e) => e.lang === lang), ...hits.filter((e) => e.lang !== lang)];
}

/** Groups in catalogue order; empty groups are left out. */
export function groupCatalog(
  entries: readonly CatalogEntry[],
): { category: CatalogCategory; entries: CatalogEntry[] }[] {
  return CATALOG_CATEGORIES.map((category) => ({
    category,
    entries: entries.filter((e) => e.category === category),
  })).filter((g) => g.entries.length > 0);
}

/**
 * Three suggestions for the empty page: the first source not yet subscribed from news, tech and
 * science (one each, so the three differ), in the catalogue language.
 */
export function suggestions(
  lang: CatalogLang,
  subscribed: ReadonlySet<string>,
  entries: readonly CatalogEntry[] = CATALOG,
): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const category of ['news', 'tech', 'science'] as const) {
    const pick = entries.find(
      (e) => e.lang === lang && e.category === category && !subscribed.has(feedKey(e.url)),
    );
    if (pick) out.push(pick);
  }
  return out;
}
