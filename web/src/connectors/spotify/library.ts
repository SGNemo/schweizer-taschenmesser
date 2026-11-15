/**
 * Albums and artists: the saved albums (`user-library-read`), saving an album (`user-library-modify`, same feature as
 * the hearts), and an artist page (no scope). Read on request, names never stored; tolerant parsers like `browse.ts`.
 */
import { z } from 'zod';
import {
  ConnectorError,
  type ArtistPage,
  type ConnectorContext,
  type MediaItem,
} from '@/core/connectors/types';
import { API_ORIGIN, ID, call, clip, coverOf, idsOf } from './api';
import { parseTrack } from './browse';

const image = z.object({ url: z.string(), width: z.number().nullish() });
const album = z.object({
  id: z.string(),
  name: z.string(),
  artists: z.array(z.object({ name: z.string(), id: z.string().nullish() })).nullish(),
  images: z.array(image).nullish(),
  total_tracks: z.number().nullish(),
  album_type: z.string().nullish(),
});
type RawAlbum = z.infer<typeof album>;

/** One album as a tile shows it; an album without a usable id or name is left out. */
export function toAlbum(a: RawAlbum | null | undefined): MediaItem | undefined {
  if (!a || !ID.test(a.id) || !a.name.trim()) return undefined;
  return {
    kind: 'album',
    id: a.id,
    name: clip(a.name),
    subtitle: a.artists?.[0]?.name ? clip(a.artists[0].name) : undefined,
    ...coverOf(a.images),
    ...idsOf({ artists: a.artists }),
  };
}

const savedPage = z.object({
  items: z.array(z.object({ album: album.nullish() }).nullable()),
  next: z.string().nullish(),
});
/** Four pages of 50 are plenty for a grid of saved albums. */
const ALBUM_PAGES = 4;

/** The saved albums, newest first (up to 200), following Spotify's own `next` links on the API host only. */
export async function savedAlbums(ctx: ConnectorContext): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let url: string | undefined = `${API_ORIGIN}v1/me/albums?limit=50`;
  for (let page = 0; url && page < ALBUM_PAGES; page += 1) {
    const { json } = await call(ctx, 'GET', url);
    const parsed = savedPage.safeParse(json);
    if (!parsed.success) break;
    for (const e of parsed.data.items) {
      const a = toAlbum(e?.album);
      if (a) out.push(a);
    }
    url = parsed.data.next?.startsWith(API_ORIGIN) ? parsed.data.next : undefined;
  }
  return out;
}

const plainIds = (list: string[]): string[] => list.filter((i) => ID.test(i)).slice(0, 20);

/** Which of these albums are saved? One answer per id, `false` for an id that is not usable. */
export async function albumsSaved(ctx: ConnectorContext, list: string[]): Promise<boolean[]> {
  const ok = plainIds(list);
  if (ok.length === 0) return list.map(() => false);
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/me/albums/contains?ids=${ok.join(',')}`);
  const answers = z.array(z.boolean()).safeParse(json);
  const byId = new Map(ok.map((id, i) => [id, answers.success && answers.data[i] === true]));
  return list.map((id) => byId.get(id) ?? false);
}

/** Saves (`on`) or removes albums in the library. */
export async function saveAlbums(
  ctx: ConnectorContext,
  list: string[],
  on: boolean,
): Promise<void> {
  const ok = plainIds(list);
  if (ok.length === 0) throw new ConnectorError('bad-response', 'id');
  await call(ctx, on ? 'PUT' : 'DELETE', `${API_ORIGIN}v1/me/albums?ids=${ok.join(',')}`);
}

const artistSchema = z.object({ name: z.string().nullish(), images: z.array(image).nullish() });
const topSchema = z.object({ tracks: z.array(z.unknown()) });
const albumsSchema = z.object({ items: z.array(album.nullable()) });

/**
 * An artist page: name and picture, the most played songs and the albums and singles (20, newest first). Spotify offers
 * the most played songs to some apps only: a refusal there leaves that part empty, the rest of the page stays.
 */
export async function artist(ctx: ConnectorContext, id: string): Promise<ArtistPage> {
  if (!ID.test(id)) throw new ConnectorError('bad-response', 'id');
  const base = `${API_ORIGIN}v1/artists/${id}`;
  const [head, top, albums] = await Promise.all([
    call(ctx, 'GET', base),
    call(ctx, 'GET', `${base}/top-tracks`, [403, 404]).catch(() => ({ status: 404, json: null })),
    call(ctx, 'GET', `${base}/albums?include_groups=album,single&limit=20`, [403, 404]).catch(
      () => ({ status: 404, json: null }),
    ),
  ]);
  const a = artistSchema.safeParse(head.json);
  const t = top.status === 200 ? topSchema.safeParse(top.json) : undefined;
  const l = albums.status === 200 ? albumsSchema.safeParse(albums.json) : undefined;
  const seen = new Set<string>();
  return {
    name: a.success ? clip(a.data.name ?? '') : '',
    ...coverOf(a.success ? a.data.images : undefined),
    top: (t?.success ? t.data.tracks : [])
      .flatMap((x) => {
        const parsed = parseTrack(x);
        return parsed ? [parsed] : [];
      })
      .slice(0, 10),
    albums: (l?.success ? l.data.items : []).flatMap((x) => {
      const item = toAlbum(x);
      // Spotify lists the same album once per market now and then: once is enough (a single with the album's title stays).
      const key = `${x?.album_type ?? ''}:${item?.name}`;
      if (!item || seen.has(key)) return [];
      seen.add(key);
      return [item];
    }),
  };
}

/* ---- Following (feature "Folgen": `user-follow-read`, `user-follow-modify`; playlists: "Playlists bearbeiten") ---- */

const artistRow = z.object({
  id: z.string(),
  name: z.string(),
  images: z.array(image).nullish(),
});
const followingSchema = z.object({
  artists: z.object({ items: z.array(artistRow.nullable()), next: z.string().nullish() }),
});
const FOLLOW_PAGES = 4;

/** The artists the user follows (cursor pages of 50, on the API host only, up to 200). */
export async function followedArtists(ctx: ConnectorContext): Promise<MediaItem[]> {
  const out: MediaItem[] = [];
  let url: string | undefined = `${API_ORIGIN}v1/me/following?type=artist&limit=50`;
  for (let page = 0; url && page < FOLLOW_PAGES; page += 1) {
    const { json } = await call(ctx, 'GET', url);
    const parsed = followingSchema.safeParse(json);
    if (!parsed.success) break;
    for (const a of parsed.data.artists.items)
      if (a && ID.test(a.id) && a.name.trim())
        out.push({ kind: 'artist', id: a.id, name: clip(a.name), ...coverOf(a.images) });
    const next = parsed.data.artists.next;
    url = next?.startsWith(API_ORIGIN) ? next : undefined;
  }
  return out;
}

/** Which of these artists does the user follow? One answer per id, `false` for an id that is not usable. */
export async function artistsFollowed(ctx: ConnectorContext, list: string[]): Promise<boolean[]> {
  const ok = plainIds(list);
  if (ok.length === 0) return list.map(() => false);
  const { json } = await call(
    ctx,
    'GET',
    `${API_ORIGIN}v1/me/following/contains?type=artist&ids=${ok.join(',')}`,
  );
  const answers = z.array(z.boolean()).safeParse(json);
  const byId = new Map(ok.map((id, i) => [id, answers.success && answers.data[i] === true]));
  return list.map((id) => byId.get(id) ?? false);
}

/** Follows (`on`) or unfollows artists. */
export async function followArtists(
  ctx: ConnectorContext,
  list: string[],
  on: boolean,
): Promise<void> {
  const ok = plainIds(list);
  if (ok.length === 0) throw new ConnectorError('bad-response', 'id');
  await call(
    ctx,
    on ? 'PUT' : 'DELETE',
    `${API_ORIGIN}v1/me/following?type=artist&ids=${ok.join(',')}`,
  );
}

/** Does the signed-in user follow this playlist? */
export async function playlistFollowed(ctx: ConnectorContext, id: string): Promise<boolean> {
  if (!ID.test(id)) throw new ConnectorError('bad-response', 'id');
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/playlists/${id}/followers/contains`);
  const answer = z.array(z.boolean()).safeParse(json);
  return answer.success && answer.data[0] === true;
}

/** Follows (`on`, privately in the profile's list) or unfollows a playlist. */
export async function followPlaylist(
  ctx: ConnectorContext,
  id: string,
  on: boolean,
): Promise<void> {
  if (!ID.test(id)) throw new ConnectorError('bad-response', 'id');
  const url = `${API_ORIGIN}v1/playlists/${id}/followers`;
  if (on) await call(ctx, 'PUT', url, [], { public: false });
  else await call(ctx, 'DELETE', url);
}
