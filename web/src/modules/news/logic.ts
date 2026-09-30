import type { Article, Category, Feed } from './schema';

export const RETENTION_DAYS = 30;
export const MAX_PER_FEED = 500;
const DAY = 86_400_000;

/** "Klima, Bahn ; Wahl" → ['klima','bahn','wahl'] */
export function parseWords(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean);
}

const haystack = (a: Pick<Article, 'title' | 'teaser'>) => `${a.title} ${a.teaser}`.toLowerCase();

/** Applies the user's topic filter (whitelist) and mute list (blacklist). */
export function passesFilters(
  a: Pick<Article, 'title' | 'teaser'>,
  keywords: readonly string[],
  muted: readonly string[],
): boolean {
  const text = haystack(a);
  if (muted.some((w) => text.includes(w))) return false;
  return keywords.length === 0 || keywords.some((w) => text.includes(w));
}

export function matchesQuery(a: Pick<Article, 'title' | 'teaser'>, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = haystack(a);
  return words.every((w) => text.includes(w));
}

/** Articles that are too old (unless saved) or beyond the per-feed limit, oldest first. */
export function articlesToPrune<
  T extends Pick<Article, 'feedId' | 'publishedAt' | 'saved'> & { id: string },
>(articles: readonly T[], now: number): string[] {
  const doomed = new Set<string>();
  const byFeed = new Map<string, T[]>();
  for (const a of articles) {
    if (!a.saved && a.publishedAt < now - RETENTION_DAYS * DAY) doomed.add(a.id);
    const list = byFeed.get(a.feedId) ?? [];
    list.push(a);
    byFeed.set(a.feedId, list);
  }
  for (const list of byFeed.values()) {
    const keep = list
      .filter((a) => !doomed.has(a.id))
      .sort((a, b) => b.publishedAt - a.publishedAt);
    for (const a of keep.slice(MAX_PER_FEED)) if (!a.saved) doomed.add(a.id);
  }
  return [...doomed];
}

/** Backoff after `failures` consecutive errors: 5 min, 10, 20 … at most 6 h. */
export function backoffMs(failures: number): number {
  return Math.min(5 * 60_000 * 2 ** Math.max(0, failures - 1), 6 * 3_600_000);
}

export function categoriesInUse(feeds: readonly Pick<Feed, 'category'>[]): Category[] {
  return [...new Set(feeds.map((f) => f.category))];
}

/** "vor 5 Min." / "vor 3 Std." / "gestern" / date – German, coarse. */
export function ago(ms: number, now: number): string {
  const diff = Math.max(0, now - ms);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'gerade eben';
  if (min < 60) return `vor ${min} Min.`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'gestern';
  return `vor ${days} Tagen`;
}

/** Deterministic record id of an article, so a refetch updates instead of duplicating. */
export function articleId(feedId: string, guid: string): string {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < guid.length; i++) {
    const c = guid.charCodeAt(i);
    h1 = ((h1 << 5) + h1 + c) | 0;
    h2 = ((h2 << 5) + h2) ^ c;
  }
  return `art-${feedId}-${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}`;
}
