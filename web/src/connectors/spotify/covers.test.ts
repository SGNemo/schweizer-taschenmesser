import { describe, expect, it } from 'vitest';
import type { ConnectorContext } from '@/core/connectors/types';
import { likedSongs, listPlaylists, parseCurrentlyPlaying, search } from './api';
import { tracks } from './browse';

/**
 * Why the music page showed only icons: the Web API serves pictures from more hosts than `i.scdn.co`. The URLs below are the shapes
 * the service returns (album example from Spotify's OpenAPI description; playlist shapes as public playlists carry them), and
 * `OLD_RULE` is the rule that was in place: it dropped every mosaic and every uploaded playlist picture.
 */
const OLD_RULE = /^https:\/\/i\.scdn\.co\/image\/[A-Za-z0-9]+$/;
const ALBUM_ID = 'ab67616d00001e02ff9ca10b55ce82ae553c8228';
const IDS = ALBUM_ID.repeat(4);
const URLS = {
  album: `https://i.scdn.co/image/${ALBUM_ID}`,
  editorial: 'https://i.scdn.co/image/ab67706f00000002c782f5168b6e9face57c7266',
  mosaic640: `https://mosaic.scdn.co/640/${IDS}`,
  mosaic300: `https://mosaic.scdn.co/300/${IDS}`,
  mosaic60: `https://mosaic.scdn.co/60/${IDS}`,
  uploadedAk: 'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da846a4e437aa6c2a667a6e7fd46',
  uploadedFa: 'https://image-cdn-fa.spotifycdn.com/image/ab67706c0000da84a71574a2e9bd0e5dacd14eea',
  generated:
    'https://pickasso.spotifycdn.com/image/ab67c0de0000deef/dt/v1/img/radio/track/3R7O9tLNTQzXXvquonosQL/en',
};

function ctxWith(body: unknown) {
  const ctx: ConnectorContext = {
    fetch: (async () => new Response(JSON.stringify(body), { status: 200 })) as typeof fetch,
    accessToken: async () => 'AT-1',
    fetchPublic: async () => new Response(),
    secrets: { get: async () => undefined, set: async () => {}, delete: async () => {} },
    redact: (text) => text,
  };
  return ctx;
}

describe('which cover hosts the service uses, and what the host rule lets through', () => {
  it('the old rule dropped mosaics and uploaded pictures; the list of patterns keeps them', async () => {
    const lists = await listPlaylists(
      ctxWith({
        items: [
          {
            id: 'plMosaic',
            name: 'Ohne eigenes Bild',
            images: [
              { url: URLS.mosaic640, width: 640 },
              { url: URLS.mosaic300, width: 300 },
              { url: URLS.mosaic60, width: 60 },
            ],
          },
          { id: 'plAk', name: 'Eigenes Bild', images: [{ url: URLS.uploadedAk, width: null }] },
          { id: 'plFa', name: 'Eigenes Bild 2', images: [{ url: URLS.uploadedFa, width: null }] },
          { id: 'plEd', name: 'Von Spotify', images: [{ url: URLS.editorial, width: null }] },
          { id: 'plGen', name: 'Radio', images: [{ url: URLS.generated, width: null }] },
          { id: 'plNone', name: 'Leer', images: null },
        ],
      }),
    );
    const byId = Object.fromEntries(lists.map((l) => [l.id, l]));
    expect(Object.values(URLS).filter((u) => OLD_RULE.test(u))).toEqual([
      URLS.album,
      URLS.editorial,
    ]);
    // The small default is the smallest size of at least 64 px: for a mosaic that is the 300 one.
    expect(byId.plMosaic!.coverUrl).toBe(URLS.mosaic300);
    expect(byId.plMosaic!.covers).toEqual([
      { url: URLS.mosaic640, width: 640 },
      { url: URLS.mosaic300, width: 300 },
      { url: URLS.mosaic60, width: 60 },
    ]);
    expect(byId.plAk!.coverUrl).toBe(URLS.uploadedAk);
    expect(byId.plFa!.coverUrl).toBe(URLS.uploadedFa);
    expect(byId.plEd!.coverUrl).toBe(URLS.editorial);
    // Still no picture: hosts of generated playlists are not on the list, and an empty playlist has none.
    expect(byId.plGen!.coverUrl).toBeUndefined();
    expect(byId.plGen!.covers).toBeUndefined();
    expect(byId.plNone!.coverUrl).toBeUndefined();
  });

  it('a playlist view carries its own picture and every track its album sizes', async () => {
    const album = {
      name: 'Album',
      images: [
        { url: `${URLS.album}a`, width: 640 },
        { url: `${URLS.album}b`, width: 300 },
        { url: `${URLS.album}c`, width: 64 },
      ],
    };
    const list = await tracks(
      ctxWith({
        name: 'Fokus',
        images: [{ url: URLS.uploadedAk, width: null }],
        tracks: { total: 1, items: [{ track: { id: 't1', name: 'Lied', type: 'track', album } }] },
      }),
      'playlist',
      'pl1',
    );
    expect(list.covers).toEqual([{ url: URLS.uploadedAk }]);
    expect(list.items[0]!.coverUrl).toBe(`${URLS.album}c`);
    expect(list.items[0]!.covers).toHaveLength(3);
  });

  it('search results and saved songs carry pictures too', async () => {
    const images = [{ url: URLS.album, width: 300 }];
    const found = await search(
      ctxWith({
        tracks: { items: [{ id: 't1', name: 'Lied', album: { name: 'Album', images } }] },
        playlists: { items: [{ id: 'p1', name: 'Liste', images: [{ url: URLS.mosaic300 }] }] },
        albums: { items: [{ id: 'a1', name: 'Album', images }] },
      }),
      'lied',
    );
    expect(found.tracks[0]).toMatchObject({ album: 'Album', coverUrl: URLS.album });
    expect(found.playlists[0]!.covers).toEqual([{ url: URLS.mosaic300, width: 300 }]);
    expect(found.albums[0]!.coverUrl).toBe(URLS.album);

    const liked = await likedSongs(
      ctxWith({
        items: [{ track: { id: 't1', name: 'Lied', duration_ms: 1000, album: { images } } }],
      }),
    );
    expect(liked[0]).toMatchObject({ coverUrl: URLS.album, durationMs: 1000 });
  });

  it('an episode takes its own picture, a track its album picture', () => {
    const images = [{ url: URLS.album, width: 300 }];
    const episode = parseCurrentlyPlaying({
      is_playing: true,
      currently_playing_type: 'episode',
      item: { name: 'Folge', show: { name: 'Sendung' }, images },
    });
    expect(episode!.covers).toEqual([{ url: URLS.album, width: 300 }]);
  });
});
