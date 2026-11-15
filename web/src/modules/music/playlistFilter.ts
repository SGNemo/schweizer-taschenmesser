import type { Playlist } from '@/core/connectors/types';
import { compareText } from '@/core/i18n/format';

export type PlaylistFilter = 'all' | 'own' | 'followed';
export type PlaylistSort = 'spotify' | 'name' | 'count';
export interface PlaylistView {
  filter: PlaylistFilter;
  sort: PlaylistSort;
}

export const VIEW_KEY = 'tm-music-playlists';
const DEFAULT: PlaylistView = { filter: 'all', sort: 'spotify' };
const FILTERS: readonly PlaylistFilter[] = ['all', 'own', 'followed'];
const SORTS: readonly PlaylistSort[] = ['spotify', 'name', 'count'];

/** The tab's filter and sort, device-local (only these two words, never a name); anything unknown reads as the default. */
export function readView(): PlaylistView {
  try {
    const raw = JSON.parse(
      localStorage.getItem(VIEW_KEY) ?? 'null',
    ) as Partial<PlaylistView> | null;
    return {
      filter: FILTERS.includes(raw?.filter as PlaylistFilter)
        ? (raw!.filter as PlaylistFilter)
        : DEFAULT.filter,
      sort: SORTS.includes(raw?.sort as PlaylistSort) ? (raw!.sort as PlaylistSort) : DEFAULT.sort,
    };
  } catch {
    return DEFAULT;
  }
}

export function writeView(view: PlaylistView): void {
  try {
    if (view.filter === DEFAULT.filter && view.sort === DEFAULT.sort)
      localStorage.removeItem(VIEW_KEY);
    else localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    // Storage blocked: the choice lasts while the page is open.
  }
}

/** Own = made by this account. A shared list someone else made counts as followed (it can still be edited). */
export const isOwn = (p: Playlist, me: string | undefined): boolean => !!me && p.ownerId === me;

/**
 * The playlists the tab shows: a search over name and description (case and accents ignored), the filter, the sort
 * ("Wie in Spotify" keeps Spotify's order, the most recently used first).
 */
export function selectPlaylists(
  all: readonly Playlist[],
  view: PlaylistView,
  query: string,
  me: string | undefined,
): Playlist[] {
  const q = fold(query.trim());
  const shown = all.filter(
    (p) =>
      (view.filter === 'all' || (view.filter === 'own') === isOwn(p, me)) &&
      (!q || fold(p.name).includes(q) || fold(p.description ?? '').includes(q)),
  );
  if (view.sort === 'name') shown.sort((a, b) => compareText(a.name, b.name));
  if (view.sort === 'count')
    shown.sort((a, b) => (b.trackCount ?? 0) - (a.trackCount ?? 0) || compareText(a.name, b.name));
  return shown;
}

const fold = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
