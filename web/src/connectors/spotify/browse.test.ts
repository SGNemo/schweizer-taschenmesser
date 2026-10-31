import { describe, expect, it } from 'vitest';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import {
  addToQueue,
  devices,
  playFrom,
  queue,
  recent,
  save,
  saved,
  toTrack,
  tracks,
  transfer,
} from './browse';

// Handwritten bodies shaped after the documented responses (no network in tests).
function ctxWith(replies: Response[]) {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const ctx: ConnectorContext = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body as string });
      return replies.shift()!;
    }) as typeof fetch,
    accessToken: async () => 'AT-1',
    fetchPublic: async () => new Response(),
    secrets: { get: async () => undefined, set: async () => {}, delete: async () => {} },
    redact: (text) => text,
  };
  return { ctx, calls };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const noContent = () => new Response(null, { status: 204 });

const T = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  type: 'track',
  duration_ms: 185_000,
  artists: [{ name: 'Erfundene Band' }],
  album: {
    name: 'Erfundenes Album',
    images: [{ url: 'https://i.scdn.co/image/ab67AAA', width: 300 }],
  },
  ...extra,
});

describe('toTrack', () => {
  it('reads name, artist, album, length and cover', () => {
    expect(toTrack(T('t1', 'Testlied'))).toEqual({
      kind: 'track',
      id: 't1',
      name: 'Testlied',
      subtitle: 'Erfundene Band',
      album: 'Erfundenes Album',
      durationMs: 185_000,
      coverUrl: 'https://i.scdn.co/image/ab67AAA',
    });
  });

  it('skips episodes, local files, rows without a usable id or name', () => {
    expect(toTrack(T('e1', 'Folge', { type: 'episode' }))).toBeUndefined();
    expect(toTrack(T('l1', 'Lokal', { is_local: true }))).toBeUndefined();
    expect(toTrack(T('bad id!', 'X'))).toBeUndefined();
    expect(toTrack({ id: null, name: 'Ohne' })).toBeUndefined();
    expect(toTrack(T('t2', '   '))).toBeUndefined();
    expect(toTrack(null)).toBeUndefined();
  });

  it('never keeps a cover from a foreign host', () => {
    const t = toTrack(
      T('t3', 'X', {
        album: { name: 'A', images: [{ url: 'https://evil.test/c.jpg', width: 300 }] },
      }),
    );
    expect(t?.coverUrl).toBeUndefined();
  });
});

describe('tracks', () => {
  const playlist = (items: unknown[], next: string | null = null) => ({
    name: 'Fokus',
    owner: { display_name: 'Ich' },
    images: [{ url: 'https://i.scdn.co/image/ab67PL', width: 300 }],
    tracks: { total: 3, items, next },
  });

  it('reads a playlist with its name, owner, cover and songs (documented shape)', async () => {
    const { ctx, calls } = ctxWith([
      json(playlist([{ track: T('a1', 'Eins') }, { track: T('a2', 'Zwei') }, { track: null }])),
    ]);
    const list = await tracks(ctx, 'playlist', 'PL1');
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/playlists/PL1');
    expect(list).toMatchObject({ name: 'Fokus', subtitle: 'Ich', total: 3 });
    expect(list.items.map((i) => i.id)).toEqual(['a1', 'a2']);
    expect(list.coverUrl).toBe('https://i.scdn.co/image/ab67PL');
  });

  it('also reads the newer shape (`items` container, `item` entries)', async () => {
    const { ctx } = ctxWith([
      json({ name: 'Neu', items: { total: 1, items: [{ item: T('n1', 'Neues Lied') }] } }),
    ]);
    expect((await tracks(ctx, 'playlist', 'PL2')).items.map((i) => i.name)).toEqual(['Neues Lied']);
  });

  it('follows `next` up to 200 songs and never to a foreign host', async () => {
    const many = (from: number, n: number) =>
      Array.from({ length: n }, (_, i) => ({ track: T(`m${from + i}`, `Lied ${from + i}`) }));
    const { ctx, calls } = ctxWith([
      json(playlist(many(0, 100), 'https://api.spotify.com/v1/playlists/PL3/tracks?offset=100')),
      json({
        items: many(100, 100),
        next: 'https://api.spotify.com/v1/playlists/PL3/tracks?offset=200',
        total: 450,
      }),
      json({ items: many(200, 100), next: null }),
    ]);
    const list = await tracks(ctx, 'playlist', 'PL3');
    expect(list.items).toHaveLength(200);
    expect(calls).toHaveLength(2);

    const foreign = ctxWith([json(playlist(many(0, 2), 'https://evil.example.test/x')), json({})]);
    expect((await tracks(foreign.ctx, 'playlist', 'PL4')).items).toHaveLength(2);
    expect(foreign.calls).toHaveLength(1);
  });

  it('reads an album: its tracks carry the album name and cover', async () => {
    const { ctx, calls } = ctxWith([
      json({
        name: 'Album Eins',
        artists: [{ name: 'Band' }],
        images: [{ url: 'https://i.scdn.co/image/ab67AL', width: 300 }],
        tracks: {
          total: 1,
          items: [
            {
              id: 'x1',
              name: 'Stück',
              type: 'track',
              duration_ms: 1000,
              artists: [{ name: 'Band' }],
            },
          ],
        },
      }),
    ]);
    const list = await tracks(ctx, 'album', 'AL1');
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/albums/AL1');
    expect(list).toMatchObject({ name: 'Album Eins', subtitle: 'Band', total: 1 });
    expect(list.items[0]).toMatchObject({
      id: 'x1',
      album: 'Album Eins',
      coverUrl: 'https://i.scdn.co/image/ab67AL',
    });
  });

  it('an unexpected shape is an empty list, a bad id never reaches the request', async () => {
    expect((await tracks(ctxWith([json({ nope: 1 })]).ctx, 'playlist', 'PL1')).items).toEqual([]);
    const none = ctxWith([]);
    await expect(tracks(none.ctx, 'playlist', 'x/../y')).rejects.toBeInstanceOf(ConnectorError);
    expect(none.calls).toEqual([]);
  });
});

describe('playFrom', () => {
  it('starts the track inside its playlist or album', async () => {
    const { ctx, calls } = ctxWith([noContent(), noContent()]);
    await playFrom(ctx, { kind: 'playlist', id: 'PL1' }, 'a2');
    await playFrom(ctx, { kind: 'album', id: 'AL1' }, 'x1');
    expect(calls.map((c) => `${c.method} ${c.body}`)).toEqual([
      'PUT {"context_uri":"spotify:playlist:PL1","offset":{"uri":"spotify:track:a2"}}',
      'PUT {"context_uri":"spotify:album:AL1","offset":{"uri":"spotify:track:x1"}}',
    ]);
    await expect(playFrom(ctx, { kind: 'playlist', id: 'PL1' }, 'a"2')).rejects.toBeInstanceOf(
      ConnectorError,
    );
  });
});

describe('recent, queue and devices', () => {
  it('recent lists each song once, newest first', async () => {
    const { ctx, calls } = ctxWith([
      json({
        items: [{ track: T('r1', 'Eins') }, { track: T('r2', 'Zwei') }, { track: T('r1', 'Eins') }],
      }),
    ]);
    expect((await recent(ctx)).map((i) => i.id)).toEqual(['r1', 'r2']);
    expect(calls[0]!.url).toContain('/me/player/recently-played?limit=50');
  });

  it('queue gives what plays and what comes next', async () => {
    const { ctx } = ctxWith([
      json({
        currently_playing: T('c1', 'Jetzt'),
        queue: [T('q1', 'Danach'), T('q2', 'Dann', { type: 'episode' })],
      }),
    ]);
    const q = await queue(ctx);
    expect(q.current?.name).toBe('Jetzt');
    expect(q.next.map((i) => i.id)).toEqual(['q1']);
  });

  it('addToQueue sends the track uri, nothing else', async () => {
    const { ctx, calls } = ctxWith([noContent()]);
    await addToQueue(ctx, 'q9');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.spotify.com/v1/me/player/queue?uri=spotify%3Atrack%3Aq9',
    });
    await expect(addToQueue(ctx, 'q 9')).rejects.toBeInstanceOf(ConnectorError);
  });

  it('devices skip restricted ones; transfer keeps the music playing', async () => {
    const { ctx, calls } = ctxWith([
      json({
        devices: [
          { id: 'd1', name: 'Küche', type: 'Speaker', is_active: true, volume_percent: 30 },
          { id: 'd2', name: 'Fernseher', type: 'TV', is_active: false, is_restricted: true },
          { id: null, name: 'Ohne Id', type: 'Computer' },
        ],
      }),
      noContent(),
    ]);
    const list = await devices(ctx);
    expect(list).toEqual([{ id: 'd1', name: 'Küche', type: 'Speaker', active: true, volume: 30 }]);
    await transfer(ctx, 'd1');
    expect(calls[1]).toMatchObject({ method: 'PUT', url: 'https://api.spotify.com/v1/me/player' });
    expect(calls[1]!.body).toBe('{"device_ids":["d1"],"play":true}');
    await expect(transfer(ctx, 'd 1;x')).rejects.toBeInstanceOf(ConnectorError);
  });
});

describe('saved songs', () => {
  it('asks which ids are saved, one answer per id in order', async () => {
    const { ctx, calls } = ctxWith([json([true, false])]);
    expect(await saved(ctx, ['a1', 'b 2', 'c3'])).toEqual([true, false, false]);
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/me/tracks/contains?ids=a1,c3');
  });

  it('a malformed answer means "not saved", and no usable id sends no request', async () => {
    expect(await saved(ctxWith([json({ x: 1 })]).ctx, ['a1'])).toEqual([false]);
    const none = ctxWith([]);
    expect(await saved(none.ctx, ['bad id'])).toEqual([false]);
    expect(none.calls).toEqual([]);
  });

  it('save uses PUT, remove uses DELETE; both on checked ids only', async () => {
    const { ctx, calls } = ctxWith([noContent(), noContent()]);
    await save(ctx, ['a1', 'b 2'], true);
    await save(ctx, ['a1'], false);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'PUT https://api.spotify.com/v1/me/tracks?ids=a1',
      'DELETE https://api.spotify.com/v1/me/tracks?ids=a1',
    ]);
    await expect(save(ctx, ['bad id'], true)).rejects.toBeInstanceOf(ConnectorError);
  });

  it('a missing scope is "denied"', async () => {
    const { ctx } = ctxWith([json({ error: { status: 403 } }, 403)]);
    await expect(save(ctx, ['a1'], true)).rejects.toMatchObject({ code: 'denied' });
  });
});
