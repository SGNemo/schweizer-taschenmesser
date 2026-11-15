import type { MediaItem, Playlist } from '@/core/connectors/types';

/** One "Weiterhören" tile: a playlist, album or artist something was played from lately. */
export interface ContinueItem {
  kind: 'playlist' | 'album' | 'artist';
  id: string;
  name: string;
  cover: Pick<MediaItem, 'coverUrl' | 'covers'>;
}

const SHOWN = 6;

/**
 * "Weiterhören" without an extra request: the playlists, albums and artists the recent songs were played from, newest
 * first, each once. Names come from what is already on the page – an album from its song, an artist from its song, a
 * playlist from the playlists list (one that is not in the list, e.g. a generated mix, is left out rather than shown
 * without a name).
 */
export function continueFrom(
  recent: readonly MediaItem[],
  playlists: readonly Playlist[] | undefined,
): ContinueItem[] {
  const byId = new Map((playlists ?? []).map((p) => [p.id, p]));
  const seen = new Set<string>();
  const out: ContinueItem[] = [];
  for (const song of recent) {
    const c = song.context;
    if (!c || seen.has(`${c.kind}:${c.id}`)) continue;
    seen.add(`${c.kind}:${c.id}`);
    if (c.kind === 'playlist') {
      const p = byId.get(c.id);
      if (p) out.push({ kind: 'playlist', id: c.id, name: p.name, cover: p });
    } else if (c.kind === 'album' && song.album && song.albumId === c.id) {
      out.push({ kind: 'album', id: c.id, name: song.album, cover: song });
    } else if (c.kind === 'artist' && song.subtitle && song.artistId === c.id) {
      out.push({ kind: 'artist', id: c.id, name: song.subtitle, cover: {} });
    }
    if (out.length === SHOWN) break;
  }
  return out;
}
