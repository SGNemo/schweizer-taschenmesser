import { z } from 'zod';
import {
  ConnectorError,
  type ConnectorContext,
  type NowPlaying,
  type NowPlayingCommand,
  type Playlist,
} from '@/core/connectors/types';

const PLAYER = 'https://api.spotify.com/v1/me/player';
const MAX_TEXT = 200;
/** Links from the service open in the browser: only Spotify's own site is accepted. */
const OPEN_URL = /^https:\/\/open\.spotify\.com\//;

const itemSchema = z.object({
  name: z.string(),
  artists: z.array(z.object({ name: z.string() })).optional(),
  show: z.object({ name: z.string() }).optional(),
  external_urls: z.object({ spotify: z.string().optional() }).optional(),
});
const playingSchema = z.object({
  is_playing: z.boolean().optional(),
  currently_playing_type: z.string().optional(),
  item: itemSchema.nullish(),
});

const clip = (text: string): string => text.trim().slice(0, MAX_TEXT);

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
  return {
    title,
    artist,
    playing: is_playing === true,
    trackUrl: url && OPEN_URL.test(url) ? url : undefined,
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
async function call(
  ctx: ConnectorContext,
  method: 'GET' | 'PUT' | 'POST',
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
  items: z.array(z.object({ id: z.string(), name: z.string() }).nullable()),
});
/** Playlist ids are plain base-62; anything else never reaches a URI. */
const PLAYLIST_ID = /^[A-Za-z0-9]{1,40}$/;

/** The first 50 playlists the user owns or follows (`playlist-read-private`). */
export async function listPlaylists(ctx: ConnectorContext): Promise<Playlist[]> {
  const { json } = await call(ctx, 'GET', 'https://api.spotify.com/v1/me/playlists?limit=50');
  const parsed = playlistsSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.items
    .filter((p): p is { id: string; name: string } => p !== null && PLAYLIST_ID.test(p.id))
    .map((p) => ({ id: p.id, name: clip(p.name) }));
}

export async function startPlaylist(ctx: ConnectorContext, id: string): Promise<void> {
  if (!PLAYLIST_ID.test(id)) throw new ConnectorError('bad-response', 'playlist id');
  await call(ctx, 'PUT', `${PLAYER}/play`, [], { context_uri: `spotify:playlist:${id}` });
}
