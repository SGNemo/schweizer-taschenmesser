import type { BookmarkItem, Kind } from './schema';

/** "example.com/x" → "https://example.com/x"; anything that is not a http(s) address → undefined. */
export function normalizeUrl(input: string): string | undefined {
  const text = input.trim();
  if (!text) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function hostOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).host.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

/** "Rezept, #Kochen  urlaub" → ['Rezept', 'Kochen', 'urlaub']; duplicates (any case) are dropped. */
export function parseTags(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/[,;\s]+/)) {
    const tag = raw.replace(/^#+/, '').trim();
    if (!tag || seen.has(tag.toLowerCase())) continue;
    seen.add(tag.toLowerCase());
    out.push(tag);
  }
  return out;
}

export const formatTags = (tags: readonly string[]): string => tags.join(', ');

/** Every tag with its number of items, most used first (ties alphabetical). */
export function tagCounts(items: readonly Pick<BookmarkItem, 'tags'>[]): [string, number][] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const item of items) {
    for (const tag of item.tags) {
      const key = tag.toLowerCase();
      const entry = counts.get(key);
      if (entry) entry.n += 1;
      else counts.set(key, { label: tag, n: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'de'))
    .map((e) => [e.label, e.n]);
}

export interface Filter {
  view: 'open' | 'done' | 'all';
  kind: Kind | 'all';
  tag?: string;
  query: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterItems<T extends BookmarkItem & { createdAt: number }>(
  items: readonly T[],
  f: Filter,
): T[] {
  const q = fold(f.query.trim());
  return items
    .filter((i) => f.view === 'all' || (f.view === 'done') === i.done)
    .filter((i) => f.kind === 'all' || i.kind === f.kind)
    .filter((i) => !f.tag || i.tags.some((t) => t.toLowerCase() === f.tag!.toLowerCase()))
    .filter(
      (i) => !q || fold([i.title, i.url ?? '', i.note ?? '', ...i.tags].join(' ')).includes(q),
    )
    .sort((a, b) => b.createdAt - a.createdAt);
}
