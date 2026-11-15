import { coverCandidates, pickCover } from '@/core/connectors/coverUrl';
import { z } from 'zod';
import {
  ConnectorError,
  type ConnectorContext,
  type NowPlaying,
  type MediaItem,
  type NowPlayingCommand,
  type PlayerState,
  type Playlist,
  type SearchResult,
} from '@/core/connectors/types';

export const PLAYER = 'https://api.spotify.com/v1/me/player';
const MAX_TEXT = 200;
/** Links from the service open in the browser: only Spotify's own site is accepted. */
const OPEN_URL = /^https:\/\/open\.spotify\.com\//;

const imageSchema = z.object({ url: z.string(), width: z.number().nullish() });
const itemSchema = z.object({
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })).optional(),
  show: z.object({ name: z.string() }).optional(),
  album: z
    .object({ name: z.string().optional(), images: z.array(imageSchema).optional() })
    .optional(),
  images: z.array(imageSchema).optional(),
  duration_ms: z.number().optional(),
  external_urls: z.object({ spotify: z.string().optional() }).optional(),
});
const playingSchema = z.object({
  progress_ms: z.number().nullish(),
  is_playing: z.boolean().optional(),
  currently_playing_type: z.string().optional(),
  item: itemSchema.nullish(),
});

export const clip = (text: string): string => text.trim().slice(0, MAX_TEXT);

type RawImages = { url: string; width?: number | null }[] | null | undefined;
/** The cover fields of an item: the small default (`coverUrl`, at least 64 px) and every size that passed the host rule. */
export const coverOf = (images: RawImages) => ({
  coverUrl: pickCover(images),
  covers: coverCandidates(images),
});

/**
 * `GET /me/player/currently-playing` (200 body) → what the line shows. A track gives its first artist,
 * a podcast episode its show. Advertisements, private sessions (no item) and unknown shapes read as
 * "nothing playing". The text is user data: callers keep it on this device only.
 */
export function parseCurrentlyPlaying(json: unknown): NowPlaying | undefined {
  const parsed = playingSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const { item, currently_playing_type: kind, is_playing } = parsed.data;
  if (!item || (kind !== 'track' && kind !== 'episode')) return undefined;
  const title = clip(item.name);
  const artist = clip(
    kind === 'episode' ? (item.show?.name ?? '') : (item.artists?.[0]?.name ?? ''),
  );
  if (!title) return undefined;
  const url = item.external_urls?.spotify;
  const album = kind === 'episode' ? undefined : clip(item.album?.name ?? '');
  return {
    title,
    artist,
    playing: is_playing === true,
    trackUrl: url && OPEN_URL.test(url) ? url : undefined,
    album: album || undefined,
    ...coverOf(kind === 'episode' ? item.images : item.album?.images),
    progressMs: parsed.data.progress_ms ?? undefined,
    durationMs: item.duration_ms,
  };
}

interface Reply {
  status: number;
  json: unknown;
}

/**
 * One call against the Web API. 401 → a fresh token, one more try; 429 → `rate-limited` with
 * `Retry-After`; 403 `PREMIUM_REQUIRED` → `premium-required`. Statuses in `allow` are returned.
 */
export async function call(
  ctx: ConnectorContext,
  method: 'GET' | 'PUT' | 'POST' | 'DELETE',
  url: string,
  allow: number[] = [],
  json?: unknown,
): Promise<Reply> {
  for (let attempt = 0; ; attempt += 1) {
    const token = await ctx.accessToken(attempt > 0 ? { refresh: true } : undefined);
    let res: Response;
    try {
      res = await ctx.fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(json === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(json === undefined ? {} : { body: JSON.stringify(json) }),
      });
    } catch (e) {
      throw new ConnectorError('network', ctx.redact(String(e)));
    }
    if (res.status === 401 && attempt === 0) continue;
    let reply: unknown = null;
    if (res.status !== 204) {
      try {
        reply = await res.json();
      } catch {
        // Not JSON: the status below decides.
      }
    }
    if (res.ok || allow.includes(res.status)) return { status: res.status, json: reply };
    if (res.status === 401) throw new ConnectorError('expired', 'http 401');
    if (res.status === 429)
      throw new ConnectorError(
        'rate-limited',
        'rate-limited',
        Number(res.headers.get('retry-after')) || undefined,
      );
    const reason = (reply as { error?: { reason?: string } } | null)?.error?.reason;
    if (res.status === 403 && reason === 'PREMIUM_REQUIRED')
      throw new ConnectorError('premium-required', reason);
    if (res.status === 403) throw new ConnectorError('denied', ctx.redact(reason ?? 'http 403'));
    if (res.status >= 500) throw new ConnectorError('network', `http ${res.status}`);
    throw new ConnectorError('bad-response', ctx.redact(reason ?? `http ${res.status}`));
  }
}

export async function readCurrentlyPlaying(ctx: ConnectorContext): Promise<NowPlaying | undefined> {
  const { status, json } = await call(
    ctx,
    'GET',
    `${PLAYER}/currently-playing?additional_types=episode`,
    [204],
  );
  return status === 204 ? undefined : parseCurrentlyPlaying(json);
}

const COMMANDS: Record<NowPlayingCommand, { method: 'PUT' | 'POST'; path: string }> = {
  previous: { method: 'POST', path: '/previous' },
  pause: { method: 'PUT', path: '/pause' },
  play: { method: 'PUT', path: '/play' },
  next: { method: 'POST', path: '/next' },
};

export async function sendCommand(
  ctx: ConnectorContext,
  command: NowPlayingCommand,
): Promise<void> {
  const { method, path } = COMMANDS[command];
  await call(ctx, method, `${PLAYER}${path}`);
}

const playlistsSchema = z.object({
  items: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullish(),
        collaborative: z.boolean().nullish(),
        images: z.array(imageSchema).nullish(),
        owner: z.object({ id: z.string().nullish(), display_name: z.string().nullish() }).nullish(),
        // The documented field is `tracks`; the newer shape calls the same object `items`.
        tracks: z.object({ total: z.number().nullish() }).nullish(),
        items: z.object({ total: z.number().nullish() }).nullish(),
      })
      .nullable(),
  ),
  next: z.string().nullish(),
});
/** Pages of 50; four pages (200 playlists) are enough for a picker and keep the request count small. */
const MAX_PLAYLIST_PAGES = 4;
/** The playlists tab lists every playlist: up to 20 pages (1000), still one request per 50. */
const ALL_PLAYLIST_PAGES = 20;
export const API_ORIGIN = 'https://api.spotify.com/';
/** Playlist ids are plain base-62; anything else never reaches a URI. */
const PLAYLIST_ID = /^[A-Za-z0-9]{1,40}$/;
/** Account ids are short and plain (letters, digits, `.`, `_`, `-`); anything else is dropped. */
export const ACCOUNT_ID = /^[A-Za-z0-9._-]{1,64}$/;
const MAX_DESCRIPTION = 300;

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};
/**
 * A playlist description as plain text: Spotify sends it HTML-escaped and with links as `<a>` tags. Tags are dropped,
 * the common entities decoded, white space folded; the result is only ever rendered as text, never as HTML.
 */
export function plainText(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // Tags go until none is left (a nested `<<b>x>` would otherwise leave one behind).
  let stripped = raw;
  for (let prev = ''; prev !== stripped; ) {
    prev = stripped;
    stripped = stripped.replace(/<[^<>]*>/g, '');
  }
  const text = stripped
    .replace(/[<>]/g, '')
    .replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z]{2,6});/gi, (all, code: string) => {
      const c = code.toLowerCase();
      const n = c.startsWith('#x')
        ? parseInt(c.slice(2), 16)
        : c.startsWith('#')
          ? Number(c.slice(1))
          : NaN;
      if (Number.isFinite(n)) return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : '';
      return ENTITIES[c] ?? all;
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_DESCRIPTION);
  return text || undefined;
}

/**
 * The user's playlists, own and followed (`playlist-read-private`), following Spotify's own `next` links: up to 200 for
 * a picker, up to 1000 with `all` (the playlists tab).
 */
export async function listPlaylists(
  ctx: ConnectorContext,
  opts?: { all?: boolean },
): Promise<Playlist[]> {
  const out: Playlist[] = [];
  const pages = opts?.all ? ALL_PLAYLIST_PAGES : MAX_PLAYLIST_PAGES;
  let url: string | null | undefined = `${API_ORIGIN}v1/me/playlists?limit=50`;
  for (let page = 0; url && page < pages; page += 1) {
    const { json } = await call(ctx, 'GET', url);
    const parsed = playlistsSchema.safeParse(json);
    if (!parsed.success) break;
    for (const p of parsed.data.items)
      if (p !== null && PLAYLIST_ID.test(p.id))
        out.push({
          id: p.id,
          name: clip(p.name),
          trackCount: p.tracks?.total ?? p.items?.total ?? undefined,
          ...coverOf(p.images),
          owner: p.owner?.display_name ? clip(p.owner.display_name) : undefined,
          ownerId: p.owner?.id && ACCOUNT_ID.test(p.owner.id) ? p.owner.id : undefined,
          description: plainText(p.description),
          collaborative: p.collaborative === true || undefined,
        });
    // Only follow a link that stays on the API host, never one the response made up.
    url = parsed.data.next?.startsWith(API_ORIGIN) ? parsed.data.next : undefined;
  }
  return out;
}

const accountSchema = z.object({ id: z.string() });

/**
 * The signed-in account's id (`GET /me`, no extra scope), only to tell own playlists from followed ones. Kept in memory
 * by the caller; nothing else of the profile is read.
 */
export async function accountId(ctx: ConnectorContext): Promise<string | undefined> {
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/me`);
  const parsed = accountSchema.safeParse(json);
  return parsed.success && ACCOUNT_ID.test(parsed.data.id) ? parsed.data.id : undefined;
}

export async function startPlaylist(ctx: ConnectorContext, id: string): Promise<void> {
  if (!PLAYLIST_ID.test(id)) throw new ConnectorError('bad-response', 'playlist id');
  await call(ctx, 'PUT', `${PLAYER}/play`, [], { context_uri: `spotify:playlist:${id}` });
}

const stateSchema = z.object({
  device: z.object({ name: z.string(), volume_percent: z.number().nullish() }).nullish(),
  shuffle_state: z.boolean().optional(),
  repeat_state: z.enum(['off', 'track', 'context']).optional(),
});

/** Device, volume, shuffle and repeat (`GET /me/player`, same scope as the reading); 204 = no active device. */
export async function readPlayerState(ctx: ConnectorContext): Promise<PlayerState | undefined> {
  const { status, json } = await call(ctx, 'GET', PLAYER, [204]);
  if (status === 204) return undefined;
  const parsed = stateSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const d = parsed.data;
  return {
    device: d.device ? clip(d.device.name) : undefined,
    volume: d.device?.volume_percent ?? undefined,
    shuffle: d.shuffle_state,
    repeat: d.repeat_state,
  };
}

export async function seek(ctx: ConnectorContext, ms: number): Promise<void> {
  const pos = Math.max(0, Math.round(ms));
  await call(ctx, 'PUT', `${PLAYER}/seek?position_ms=${pos}`);
}

export async function setVolume(ctx: ConnectorContext, percent: number): Promise<void> {
  const v = Math.min(100, Math.max(0, Math.round(percent)));
  await call(ctx, 'PUT', `${PLAYER}/volume?volume_percent=${v}`);
}

export async function setShuffle(ctx: ConnectorContext, on: boolean): Promise<void> {
  await call(ctx, 'PUT', `${PLAYER}/shuffle?state=${on ? 'true' : 'false'}`);
}

export async function setRepeat(
  ctx: ConnectorContext,
  mode: 'off' | 'track' | 'context',
): Promise<void> {
  await call(ctx, 'PUT', `${PLAYER}/repeat?state=${mode}`);
}

export const ID = /^[A-Za-z0-9]{1,40}$/;
const searchSchema = z.object({
  tracks: z
    .object({
      items: z.array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            artists: z.array(z.object({ name: z.string() })).optional(),
            album: z
              .object({ name: z.string().nullish(), images: z.array(imageSchema).nullish() })
              .nullish(),
          })
          .nullable(),
      ),
    })
    .optional(),
  playlists: z
    .object({
      items: z.array(
        z
          .object({ id: z.string(), name: z.string(), images: z.array(imageSchema).nullish() })
          .nullable(),
      ),
    })
    .optional(),
  albums: z
    .object({
      items: z.array(
        z
          .object({
            id: z.string(),
            name: z.string(),
            artists: z.array(z.object({ name: z.string() })).optional(),
            images: z.array(imageSchema).nullish(),
          })
          .nullable(),
      ),
    })
    .optional(),
});

type Named = {
  id: string;
  name: string;
  artists?: { name: string }[];
  images?: RawImages;
  album?: { name?: string | null; images?: RawImages } | null;
} | null;
const toItems = (kind: MediaItem['kind'], list: Named[] | undefined): MediaItem[] =>
  (list ?? []).flatMap((x) =>
    x && ID.test(x.id) && x.name.trim()
      ? [
          {
            kind,
            id: x.id,
            name: clip(x.name),
            subtitle: x.artists?.[0]?.name ? clip(x.artists[0].name) : undefined,
            // A track shows its album's picture; a playlist or album its own.
            ...(kind === 'track' && x.album?.name ? { album: clip(x.album.name) } : {}),
            ...coverOf(kind === 'track' ? x.album?.images : x.images),
          },
        ]
      : [],
  );

/** `GET /search` for tracks, playlists and albums (a few of each). The typed words are the only thing sent. */
export async function search(ctx: ConnectorContext, query: string): Promise<SearchResult> {
  const q = query.trim().slice(0, 100);
  if (q.length < 2) return { tracks: [], playlists: [], albums: [] };
  const params = new URLSearchParams({ q, type: 'track,playlist,album', limit: '6' });
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/search?${params}`);
  const parsed = searchSchema.safeParse(json);
  if (!parsed.success) return { tracks: [], playlists: [], albums: [] };
  return {
    tracks: toItems('track', parsed.data.tracks?.items),
    playlists: toItems('playlist', parsed.data.playlists?.items),
    albums: toItems('album', parsed.data.albums?.items),
  };
}

const likedSchema = z.object({
  items: z.array(
    z
      .object({
        track: z
          .object({
            id: z.string().nullish(),
            name: z.string(),
            artists: z.array(z.object({ name: z.string() })).optional(),
            duration_ms: z.number().nullish(),
            album: z
              .object({ name: z.string().nullish(), images: z.array(imageSchema).nullish() })
              .nullish(),
          })
          .nullish(),
      })
      .nullable(),
  ),
});

/** The latest 50 saved songs (`user-library-read`). */
export async function likedSongs(ctx: ConnectorContext): Promise<MediaItem[]> {
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/me/tracks?limit=50`);
  const parsed = likedSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.items.flatMap((x) => {
    const t = x?.track;
    return t?.id && ID.test(t.id) && t.name.trim()
      ? [
          {
            kind: 'track' as const,
            id: t.id,
            name: clip(t.name),
            subtitle: t.artists?.[0]?.name ? clip(t.artists[0].name) : undefined,
            album: t.album?.name ? clip(t.album.name) : undefined,
            durationMs: t.duration_ms ?? undefined,
            ...coverOf(t.album?.images),
          },
        ]
      : [];
  });
}

/**
 * Starts a track (with the tracks after it in the list, up to 100) or a whole playlist / album on the
 * active device. Ids are checked before they become part of a URI.
 */
export async function play(
  ctx: ConnectorContext,
  item: MediaItem,
  queue?: MediaItem[],
): Promise<void> {
  if (!ID.test(item.id)) throw new ConnectorError('bad-response', 'id');
  if (item.kind === 'track') {
    const tracks = (queue ?? [item])
      .filter((t) => t.kind === 'track' && ID.test(t.id))
      .slice(0, 100);
    const position = Math.max(
      0,
      tracks.findIndex((t) => t.id === item.id),
    );
    const uris =
      tracks.length > 0 ? tracks.map((t) => `spotify:track:${t.id}`) : [`spotify:track:${item.id}`];
    await call(ctx, 'PUT', `${PLAYER}/play`, [], { uris, offset: { position } });
    return;
  }
  await call(ctx, 'PUT', `${PLAYER}/play`, [], { context_uri: `spotify:${item.kind}:${item.id}` });
}
