import { compareText } from '@/core/i18n/format';
import { addDaysStr, toDateString } from '@/core/time/dates';
import { KINDS, type BookmarkItem, type Kind } from './schema';

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

/**
 * Links (kind "link", the former "Apps & Links") grouped for the tile view: the first tag is the
 * group, groups alphabetical, links without a tag last under the empty group.
 */
export function groupLinks<T extends Pick<BookmarkItem, 'tags' | 'title'>>(
  items: readonly T[],
): [string, T[]][] {
  const groups = new Map<string, { label: string; items: T[] }>();
  for (const item of items) {
    const label = item.tags[0] ?? '';
    const entry = groups.get(label.toLowerCase()) ?? { label, items: [] };
    entry.items.push(item);
    groups.set(label.toLowerCase(), entry);
  }
  return [...groups.values()]
    .sort(
      (a, b) => Number(a.label === '') - Number(b.label === '') || compareText(a.label, b.label),
    )
    .map((g) => [g.label, g.items.sort((a, b) => compareText(a.title, b.title))]);
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
    .sort((a, b) => b.n - a.n || compareText(a.label, b.label))
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

/** How the list is grouped: by when it was saved (default), by first tag or by type. */
export type Grouping = 'recent' | 'tag' | 'kind';
export const GROUPINGS: readonly Grouping[] = ['recent', 'tag', 'kind'];

/** `id` is stable and safe in a DOM id; `tag` is the tag text of a tag group ('' = no tag). */
export interface ItemGroup<T> {
  id: string;
  tag?: string;
  items: T[];
}

type Groupable = Pick<BookmarkItem, 'tags' | 'title' | 'kind'> & { createdAt: number };

/** Buckets for "recent": saved today, in the last 7 days (incl. yesterday), earlier. */
export function recentBucket(createdAt: number, day: string): 'today' | 'week' | 'older' {
  const saved = toDateString(new Date(createdAt));
  if (saved >= day) return 'today';
  return saved > addDaysStr(day, -7) ? 'week' : 'older';
}

/**
 * Groups the (already filtered) items for display; empty groups are omitted. "recent": today,
 * last 7 days, earlier, newest first. "tag": by first tag, groups alphabetical, no tag last,
 * entries by title. "kind": in the order of `KINDS`, newest first. Nothing is dropped.
 */
export function groupItems<T extends Groupable>(
  items: readonly T[],
  mode: Grouping,
  day: string,
): ItemGroup<T>[] {
  const newestFirst = (list: T[]) => list.sort((a, b) => b.createdAt - a.createdAt);
  if (mode === 'tag')
    return groupLinks(items).map(([tag, list]) => ({
      id: tag ? `tag-${encodeURIComponent(tag.toLowerCase())}` : 'none',
      tag,
      items: list,
    }));
  if (mode === 'kind')
    return KINDS.map((k) => ({
      id: k,
      items: newestFirst(items.filter((i) => i.kind === k)),
    })).filter((g) => g.items.length > 0);
  return (['today', 'week', 'older'] as const)
    .map((id) => ({
      id,
      items: newestFirst(items.filter((i) => recentBucket(i.createdAt, day) === id)),
    }))
    .filter((g) => g.items.length > 0);
}
