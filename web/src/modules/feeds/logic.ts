import type { Feed } from './schema';

/** `example.org/feed` → `https://example.org/feed`; anything that is not an http(s) address → undefined. */
export function normalizeFeedUrl(input: string): string | undefined {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (!url.hostname.includes('.')) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** Key to recognise the same feed twice: host + path without scheme, `www.` and trailing slash. */
export function feedKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${u.search}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export interface FeedGroup<T> {
  category: string;
  feeds: T[];
}

/** Groups by category, named groups A–Z first, ungrouped last; feeds A–Z inside a group. */
export function groupFeeds<T extends Pick<Feed, 'title' | 'category'>>(
  feeds: readonly T[],
  collator: Intl.Collator,
): FeedGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const feed of feeds) {
    const key = feed.category.trim();
    map.set(key, [...(map.get(key) ?? []), feed]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : collator.compare(a, b)))
    .map(([category, list]) => ({
      category,
      feeds: [...list].sort((x, y) => collator.compare(x.title, y.title)),
    }));
}
