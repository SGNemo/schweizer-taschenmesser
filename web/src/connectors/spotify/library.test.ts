import { describe, expect, it } from 'vitest';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import { search } from './api';
import { recent, tracks } from './browse';
import { albumsSaved, artist, saveAlbums, savedAlbums } from './library';

// Handwritten bodies shaped after the documented responses (no network in tests); names and ids are invented.
function ctxWith(route: (url: string, method: string) => Response) {
  const calls: { url: string; method: string }[] = [];
  const ctx: ConnectorContext = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const c = { url: String(input), method: init?.method ?? 'GET' };
      calls.push(c);
      return route(c.url, c.method);
    }) as typeof fetch,
    accessToken: async () => 'AT-1',
    fetchPublic: async () => new Response(),
    secrets: {
      get: async () => undefined,
      has: async () => false,
      set: async () => {},
      delete: async () => {},
    },
    redact: (text) => text,
  };
  return { ctx, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const A = (id: string, name: string) => ({
  id,
  name,
  artists: [{ name: 'Erfundene Band', id: 'ar1' }],
  images: [{ url: 'https://i.scdn.co/image/ab67AAA', width: 300 }],
});

describe('saved albums', () => {
  it('lists saved albums with artist id; bad ids and foreign next links are dropped', async () => {
    const { ctx, calls } = ctxWith(() =>
      json({
        items: [{ album: A('al1', 'Eins') }, { album: A('bad id', 'x') }, null],
        next: 'https://elsewhere.example/v1/me/albums?offset=50',
      }),
    );
    const out = await savedAlbums(ctx);
    expect(out).toEqual([
      expect.objectContaining({
        kind: 'album',
        id: 'al1',
        subtitle: 'Erfundene Band',
        artistId: 'ar1',
      }),
    ]);
    expect(calls).toHaveLength(1);
  });

  it('asks which albums are saved and saves or removes them with PUT / DELETE', async () => {
    const { ctx, calls } = ctxWith((url) =>
      url.includes('/contains') ? json([true]) : new Response(null, { status: 200 }),
    );
    expect(await albumsSaved(ctx, ['al1', '../x'])).toEqual([true, false]);
    await saveAlbums(ctx, ['al1'], false);
    expect(calls[1]).toEqual({
      url: 'https://api.spotify.com/v1/me/albums?ids=al1',
      method: 'DELETE',
    });
    await expect(saveAlbums(ctx, ['a/b'], true)).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe('artist page', () => {
  it('reads name, top songs and albums (each album once)', async () => {
    const { ctx } = ctxWith((url) =>
      url.endsWith('/top-tracks')
        ? json({
            tracks: [{ id: 't1', name: 'Hit', type: 'track', artists: [{ name: 'B', id: 'ar1' }] }],
          })
        : url.includes('/albums?')
          ? json({ items: [A('al1', 'Eins'), A('al2', 'Eins'), A('al3', 'Zwei')] })
          : json({ name: 'Erfundene Band', images: [] }),
    );
    const page = await artist(ctx, 'ar1');
    expect(page.name).toBe('Erfundene Band');
    expect(page.top.map((t) => t.id)).toEqual(['t1']);
    expect(page.albums.map((a) => a.id)).toEqual(['al1', 'al3']);
  });

  it('a refused "most played" leaves that part empty, the page stays', async () => {
    const { ctx } = ctxWith((url) =>
      url.endsWith('/top-tracks')
        ? json({ error: { status: 403 } }, 403)
        : url.includes('/albums?')
          ? json({ items: [A('al1', 'Eins')] })
          : json({ name: 'Erfundene Band' }),
    );
    const page = await artist(ctx, 'ar1');
    expect(page.top).toEqual([]);
    expect(page.albums).toHaveLength(1);
  });

  it('never asks with an id that is not a plain id', async () => {
    const { ctx, calls } = ctxWith(() => json({}));
    await expect(artist(ctx, '../me')).rejects.toBeInstanceOf(ConnectorError);
    expect(calls).toHaveLength(0);
  });
});

describe('ids for the artist and album views', () => {
  it('tracks carry artist and album ids; album rows carry the album id', async () => {
    const { ctx } = ctxWith(() =>
      json({
        name: 'Eins',
        artists: [{ name: 'Erfundene Band', id: 'ar1' }],
        tracks: {
          items: [{ id: 't1', name: 'Lied', type: 'track', artists: [{ name: 'B', id: 'ar1' }] }],
        },
      }),
    );
    const list = await tracks(ctx, 'album', 'al1');
    expect(list.artistId).toBe('ar1');
    expect(list.items[0]).toMatchObject({ artistId: 'ar1', albumId: 'al1' });
  });

  it('recently played songs carry the playlist, album or artist they were played from', async () => {
    const T = (id: string) => ({ id, name: `Lied ${id}`, type: 'track' });
    const { ctx } = ctxWith(() =>
      json({
        items: [
          { track: T('t1'), context: { type: 'playlist', uri: 'spotify:playlist:PL1' } },
          { track: T('t2'), context: { type: 'album', uri: 'spotify:album:al1' } },
          { track: T('t3'), context: { type: 'collection', uri: 'spotify:user:x:collection' } },
          { track: T('t4'), context: null },
        ],
      }),
    );
    const out = await recent(ctx);
    expect(out.map((t) => t.context)).toEqual([
      { kind: 'playlist', id: 'PL1' },
      { kind: 'album', id: 'al1' },
      undefined,
      undefined,
    ]);
  });

  it('the search finds artists too', async () => {
    const { ctx, calls } = ctxWith(() =>
      json({ artists: { items: [{ id: 'ar1', name: 'Erfundene Band', images: [] }, null] } }),
    );
    const out = await search(ctx, 'Band');
    expect(calls[0]!.url).toContain('type=track%2Cplaylist%2Calbum%2Cartist');
    expect(out.artists).toEqual([expect.objectContaining({ kind: 'artist', id: 'ar1' })]);
  });
});
