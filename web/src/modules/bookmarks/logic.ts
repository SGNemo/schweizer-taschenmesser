import { compareText } from '@/core/i18n/format';
import { addDaysStr, toDateString } from '@/core/time/dates';
import { KINDS, type BookmarkItem, type Kind } from './schema';
import type { Grouping, SortMode } from './settings';

export { GROUPINGS, type Grouping } from './settings';

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

/**
 * The address as a link, only for http(s) (Q3, launch review 2026-11): a bookmark from sync or a
 * share file did not pass `normalizeUrl`, so anything else (`javascript:`, `data:`, `file:` …)
 * stays plain text.
 */
export function linkOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
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

/** Query parameters that only track where a click came from; they never change the page. */
const TRACKING = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|si|ref_src)$/i;

/**
 * The address reduced to what makes it the same page: host without "www.", path without a trailing
 * slash, the remaining query sorted; scheme, fragment and tracking parameters are dropped (a fragment
 * that is a route, "#/…" or "#!…", stays). Used only
 * to compare, never stored. Not an address → undefined.
 */
export function urlKey(input: string | undefined): string | undefined {
  const normal = input ? normalizeUrl(input) : undefined;
  if (!normal) return undefined;
  const url = new URL(normal);
  const query = [...url.searchParams.entries()]
    .filter(([k]) => !TRACKING.test(k))
    .sort(([a, x], [b, y]) => a.localeCompare(b) || x.localeCompare(y))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const path = url.pathname.replace(/\/+$/, '');
  const route = /^#[/!]/.test(url.hash) ? url.hash : '';
  return `${url.host.replace(/^www\./, '').toLowerCase()}${path}${query ? `?${query}` : ''}${route}`;
}

/**
 * The saved item that is the same thing as the draft: the same page (`urlKey`), or, for a draft
 * without an address, the same title among the items without an address. `exceptId` is the item
 * being edited.
 */
export function findDuplicate<T extends Pick<BookmarkItem, 'title' | 'url'> & { id: string }>(
  items: readonly T[],
  draft: { title: string; url?: string },
  exceptId?: string,
): T | undefined {
  const others = items.filter((i) => i.id !== exceptId);
  const key = urlKey(draft.url);
  if (key) return others.find((i) => urlKey(i.url) === key);
  if (draft.url?.trim()) return undefined;
  const title = fold(draft.title.trim());
  return title ? others.find((i) => !i.url && fold(i.title.trim()) === title) : undefined;
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

/** Minutes the planner sets aside for a Merkzettel of a kind, until the person says otherwise. */
export const PLAN_MINUTES: Record<Kind, number> = {
  link: 15,
  read: 20,
  watch: 90,
  book: 30,
  place: 60,
  buy: 15,
  try: 30,
  idea: 15,
  other: 15,
};

export const planMinutesOf = (i: Pick<BookmarkItem, 'kind' | 'planMinutes'>): number =>
  i.planMinutes ?? PLAN_MINUTES[i.kind];

/** Friday to Sunday: the widget offers its three things "fürs Wochenende". */
export function isWeekendNear(day: string): boolean {
  const weekday = new Date(`${day}T12:00:00`).getDay();
  return weekday === 5 || weekday === 6 || weekday === 0;
}

/**
 * What the widget offers next: at most `max` open Merkzettel, never the permanent links (kind "link").
 * First what is in the plan (only while the planner is on: `planner`), then what was started, then the rest;
 * inside each the newest first.
 */
export function pickNext<
  T extends Pick<BookmarkItem, 'kind' | 'done' | 'started' | 'inPlan'> & { createdAt: number },
>(items: readonly T[], max = 3, planner = true): T[] {
  const rank = (i: T) => (planner && i.inPlan ? 0 : i.started ? 1 : 2);
  return items
    .filter((i) => !i.done && i.kind !== 'link')
    .sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt)
    .slice(0, max);
}

/** Open → started → done. `done` wins when both flags are set. */
export type Status = 'open' | 'started' | 'done';
export const statusOf = (i: Pick<BookmarkItem, 'done' | 'started'>): Status =>
  i.done ? 'done' : i.started ? 'started' : 'open';

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
  sort: SortMode = 'newest',
): T[] {
  const q = fold(f.query.trim());
  return items
    .filter((i) => f.view === 'all' || (f.view === 'done') === i.done)
    .filter((i) => f.kind === 'all' || i.kind === f.kind)
    .filter((i) => !f.tag || i.tags.some((t) => t.toLowerCase() === f.tag!.toLowerCase()))
    .filter(
      (i) => !q || fold([i.title, i.url ?? '', i.note ?? '', ...i.tags].join(' ')).includes(q),
    )
    .sort(sorter(sort));
}

const STATUS_ORDER: Record<Status, number> = { started: 0, open: 1, done: 2 };

/** Newest first (default), by title, by type (order of `KINDS`), or started before open before done. */
export function sorter<T extends BookmarkItem & { createdAt: number }>(
  sort: SortMode,
): (a: T, b: T) => number {
  const newest = (a: T, b: T) => b.createdAt - a.createdAt;
  if (sort === 'title') return (a, b) => compareText(a.title, b.title) || newest(a, b);
  if (sort === 'kind')
    return (a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || newest(a, b);
  if (sort === 'status')
    return (a, b) => STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)] || newest(a, b);
  return newest;
}

/** `id` is stable and safe in a DOM id; `tag` is the tag text of a tag group ('' = no tag). */
export interface ItemGroup<T> {
  id: string;
  tag?: string;
  items: T[];
}

type Groupable = Pick<BookmarkItem, 'tags' | 'title' | 'kind' | 'done' | 'started'> & {
  createdAt: number;
};

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
  sort: SortMode = 'newest',
): ItemGroup<T>[] {
  const newestFirst = (list: T[]) => list.sort(sorter<T & BookmarkItem>(sort));
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
