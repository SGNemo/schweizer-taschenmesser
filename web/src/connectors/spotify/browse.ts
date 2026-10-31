/**
 * Browsing and small edits for the player: what is inside a playlist or album, the queue, recently
 * played songs, devices, and the user's saved songs. Everything is read on request and returned as
 * plain data; the names are user data and are never stored. Parsers are tolerant (unknown or missing
 * fields give fewer details, never an error) because the service changes its shapes now and then.
 */
import { z } from 'zod';
import {
  ConnectorError,
  type ConnectorContext,
  type MediaItem,
  type PlayerDevice,
  type PlayerQueue,
  type Tracklist,
} from '@/core/connectors/types';
import { API_ORIGIN, ID, PLAYER, call, clip, pickCover } from './api';

const trackSchema = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  type: z.string().nullish(),
  is_local: z.boolean().nullish(),
  duration_ms: z.number().nullish(),
  artists: z.array(z.object({ name: z.string() })).nullish(),
  album: z
    .object({
      name: z.string().nullish(),
      images: z.array(z.object({ url: z.string(), width: z.number().nullish() })).nullish(),
    })
    .nullish(),
});
type RawTrack = z.infer<typeof trackSchema>;

/** One track as the list shows it. Podcast episodes, local files and rows without a usable id are skipped. */
export function toTrack(t: RawTrack | null | undefined): MediaItem | undefined {
  if (!t || !t.id || !ID.test(t.id) || t.is_local || (t.type && t.type !== 'track'))
    return undefined;
  const name = clip(t.name ?? '');
  if (!name) return undefined;
  const artist = t.artists?.[0]?.name ? clip(t.artists[0].name) : undefined;
  return {
    kind: 'track',
    id: t.id,
    name,
    subtitle: artist,
    album: t.album?.name ? clip(t.album.name) : undefined,
    durationMs: t.duration_ms ?? undefined,
    coverUrl: pickCover(t.album?.images ?? undefined),
  };
}

const MAX_TRACKS = 200;
const PAGE = 100;

// A playlist item is `{ track }` in the documented shape; the newer shape calls it `item`.
const entrySchema = z
  .object({ track: trackSchema.nullish(), item: trackSchema.nullish() })
  .nullable();
const pageSchema = z.object({
  items: z.array(entrySchema),
  next: z.string().nullish(),
  total: z.number().nullish(),
});
const playlistSchema = z.object({
  name: z.string().nullish(),
  owner: z.object({ display_name: z.string().nullish() }).nullish(),
  images: z.array(z.object({ url: z.string(), width: z.number().nullish() })).nullish(),
  tracks: pageSchema.nullish(),
  items: pageSchema.nullish(),
});
const albumSchema = z.object({
  name: z.string().nullish(),
  artists: z.array(z.object({ name: z.string() })).nullish(),
  images: z.array(z.object({ url: z.string(), width: z.number().nullish() })).nullish(),
  tracks: z
    .object({ items: z.array(trackSchema.nullable()), total: z.number().nullish() })
    .nullish(),
});

const entries = (page: z.infer<typeof pageSchema> | null | undefined): MediaItem[] =>
  (page?.items ?? []).flatMap((e) => {
    const t = toTrack(e?.track ?? e?.item);
    return t ? [t] : [];
  });

const sameHost = (url: string | null | undefined): string | undefined =>
  url && url.startsWith(API_ORIGIN) ? url : undefined;

/** The first 200 tracks of a playlist or album with its name and cover. */
export async function tracks(
  ctx: ConnectorContext,
  kind: 'playlist' | 'album',
  id: string,
): Promise<Tracklist> {
  if (!ID.test(id)) throw new ConnectorError('bad-response', 'id');
  if (kind === 'album') {
    const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/albums/${id}`);
    const a = albumSchema.safeParse(json);
    if (!a.success) return { name: '', items: [] };
    const items = (a.data.tracks?.items ?? []).flatMap((t) => {
      // Album tracks come without the album itself: fill it in so every row reads the same.
      const x = toTrack(t ? { ...t, album: { name: a.data.name, images: a.data.images } } : t);
      return x ? [x] : [];
    });
    return {
      name: clip(a.data.name ?? ''),
      subtitle: a.data.artists?.[0]?.name ? clip(a.data.artists[0].name) : undefined,
      coverUrl: pickCover(a.data.images ?? undefined),
      total: a.data.tracks?.total ?? items.length,
      items,
    };
  }
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/playlists/${id}`);
  const p = playlistSchema.safeParse(json);
  if (!p.success) return { name: '', items: [] };
  const first = p.data.tracks ?? p.data.items ?? undefined;
  const items = entries(first);
  let next = sameHost(first?.next);
  for (let page = 1; next && items.length < MAX_TRACKS && page < MAX_TRACKS / PAGE; page += 1) {
    const more = await call(ctx, 'GET', next);
    const parsed = pageSchema.safeParse(more.json);
    if (!parsed.success) break;
    items.push(...entries(parsed.data));
    next = sameHost(parsed.data.next);
  }
  return {
    name: clip(p.data.name ?? ''),
    subtitle: p.data.owner?.display_name ? clip(p.data.owner.display_name) : undefined,
    coverUrl: pickCover(p.data.images ?? undefined),
    total: first?.total ?? items.length,
    items: items.slice(0, MAX_TRACKS),
  };
}

/** Starts one track inside its playlist or album, so the rest of it plays on afterwards. */
export async function playFrom(
  ctx: ConnectorContext,
  context: { kind: 'playlist' | 'album'; id: string },
  trackId: string,
): Promise<void> {
  if (!ID.test(context.id) || !ID.test(trackId)) throw new ConnectorError('bad-response', 'id');
  await call(ctx, 'PUT', `${PLAYER}/play`, [], {
    context_uri: `spotify:${context.kind}:${context.id}`,
    offset: { uri: `spotify:track:${trackId}` },
  });
}

const recentSchema = z.object({
  items: z.array(z.object({ track: trackSchema.nullish() }).nullable()),
});

/** The songs played most recently (`user-read-recently-played`), each once, newest first. */
export async function recent(ctx: ConnectorContext): Promise<MediaItem[]> {
  const { json } = await call(ctx, 'GET', `${PLAYER}/recently-played?limit=50`);
  const parsed = recentSchema.safeParse(json);
  if (!parsed.success) return [];
  const seen = new Set<string>();
  const out: MediaItem[] = [];
  for (const e of parsed.data.items) {
    const t = toTrack(e?.track);
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      out.push(t);
    }
  }
  return out.slice(0, 30);
}

const queueSchema = z.object({
  currently_playing: trackSchema.nullish(),
  queue: z.array(trackSchema.nullable()),
});

/** What plays now and what comes next (`user-read-playback-state`). */
export async function queue(ctx: ConnectorContext): Promise<PlayerQueue> {
  const { json } = await call(ctx, 'GET', `${PLAYER}/queue`);
  const parsed = queueSchema.safeParse(json);
  if (!parsed.success) return { next: [] };
  return {
    current: toTrack(parsed.data.currently_playing),
    next: parsed.data.queue.flatMap((t) => {
      const x = toTrack(t);
      return x ? [x] : [];
    }),
  };
}

export async function addToQueue(ctx: ConnectorContext, trackId: string): Promise<void> {
  if (!ID.test(trackId)) throw new ConnectorError('bad-response', 'id');
  await call(ctx, 'POST', `${PLAYER}/queue?uri=${encodeURIComponent(`spotify:track:${trackId}`)}`);
}

const devicesSchema = z.object({
  devices: z.array(
    z.object({
      id: z.string().nullish(),
      name: z.string(),
      type: z.string().nullish(),
      is_active: z.boolean().nullish(),
      is_restricted: z.boolean().nullish(),
      volume_percent: z.number().nullish(),
    }),
  ),
});

export async function devices(ctx: ConnectorContext): Promise<PlayerDevice[]> {
  const { json } = await call(ctx, 'GET', `${PLAYER}/devices`);
  const parsed = devicesSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.devices.flatMap((d) =>
    d.id && !d.is_restricted
      ? [
          {
            id: d.id,
            name: clip(d.name),
            type: clip(d.type ?? ''),
            active: d.is_active === true,
            volume: d.volume_percent ?? undefined,
          },
        ]
      : [],
  );
}

/** Device ids are opaque hex strings; anything else never goes into the request. */
const DEVICE_ID = /^[A-Za-z0-9_-]{1,80}$/;

export async function transfer(ctx: ConnectorContext, deviceId: string): Promise<void> {
  if (!DEVICE_ID.test(deviceId)) throw new ConnectorError('bad-response', 'device');
  await call(ctx, 'PUT', PLAYER, [], { device_ids: [deviceId], play: true });
}

const ids = (list: string[]): string[] => list.filter((i) => ID.test(i)).slice(0, 50);

/** Which of these songs are saved? One answer per id, `false` for an id that is not usable. */
export async function saved(ctx: ConnectorContext, list: string[]): Promise<boolean[]> {
  const ok = ids(list);
  if (ok.length === 0) return list.map(() => false);
  const { json } = await call(ctx, 'GET', `${API_ORIGIN}v1/me/tracks/contains?ids=${ok.join(',')}`);
  const answers = z.array(z.boolean()).safeParse(json);
  const byId = new Map(ok.map((id, i) => [id, answers.success ? answers.data[i] === true : false]));
  return list.map((id) => byId.get(id) ?? false);
}

/** Saves (`on`) or removes songs in "Lieblingssongs" (`user-library-modify`). */
export async function save(ctx: ConnectorContext, list: string[], on: boolean): Promise<void> {
  const ok = ids(list);
  if (ok.length === 0) throw new ConnectorError('bad-response', 'id');
  await call(ctx, on ? 'PUT' : 'DELETE', `${API_ORIGIN}v1/me/tracks?ids=${ok.join(',')}`);
}
