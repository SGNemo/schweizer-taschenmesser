import { describe, expect, it, vi } from 'vitest';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import {
  COVER_URL,
  likedSongs,
  listPlaylists,
  play,
  readPlayerState,
  search,
  seek,
  setRepeat,
  setShuffle,
  setVolume,
  parseCurrentlyPlaying,
  readCurrentlyPlaying,
  sendCommand,
  startPlaylist,
} from './api';

// Handwritten bodies shaped after the documented responses of the Web API (no network in tests).
const TRACK = {
  is_playing: true,
  currently_playing_type: 'track',
  item: {
    name: 'Testlied',
    artists: [{ name: 'Erfundene Band' }, { name: 'Gast' }],
    external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
  },
};
const EPISODE = {
  is_playing: false,
  currently_playing_type: 'episode',
  item: {
    name: 'Folge 7',
    show: { name: 'Erfundener Podcast', publisher: 'Niemand' },
    external_urls: { spotify: 'https://open.spotify.com/episode/def456' },
  },
};

describe('parseCurrentlyPlaying', () => {
  it('reads title, first artist, state and link of a track', () => {
    expect(parseCurrentlyPlaying(TRACK)).toEqual({
      title: 'Testlied',
      artist: 'Erfundene Band',
      playing: true,
      trackUrl: 'https://open.spotify.com/track/abc123',
    });
  });

  it('uses the show of a podcast episode as the "artist"', () => {
    expect(parseCurrentlyPlaying(EPISODE)).toMatchObject({
      title: 'Folge 7',
      artist: 'Erfundener Podcast',
      playing: false,
    });
  });

  it('reads advertisements, private sessions and unknown shapes as nothing playing', () => {
    expect(parseCurrentlyPlaying({ ...TRACK, currently_playing_type: 'ad' })).toBeUndefined();
    expect(
      parseCurrentlyPlaying({ is_playing: true, currently_playing_type: 'track', item: null }),
    ).toBeUndefined();
    expect(parseCurrentlyPlaying({ item: { name: 5 } })).toBeUndefined();
    expect(parseCurrentlyPlaying(null)).toBeUndefined();
    expect(parseCurrentlyPlaying('x')).toBeUndefined();
  });

  it('keeps only links to open.spotify.com and shortens very long text', () => {
    const odd = {
      ...TRACK,
      item: {
        ...TRACK.item,
        name: 'x'.repeat(500),
        external_urls: { spotify: 'https://evil.test/a' },
      },
    };
    const out = parseCurrentlyPlaying(odd)!;
    expect(out.trackUrl).toBeUndefined();
    expect(out.title).toHaveLength(200);
  });
});

function ctxWith(replies: (Response | Error)[], opts: { tokens?: string[] } = {}) {
  const calls: { url: string; method?: string; auth?: string }[] = [];
  const tokens = [...(opts.tokens ?? ['AT-1', 'AT-2'])];
  const accessToken = vi.fn(async () => tokens.shift() ?? 'AT-x');
  const ctx: ConnectorContext = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(input),
        method: init?.method,
        auth: (init?.headers as Record<string, string>)?.authorization,
      });
      const next = replies.shift()!;
      if (next instanceof Error) throw next;
      return next;
    }) as typeof fetch,
    accessToken,
    fetchPublic: async () => new Response(),
    secrets: { get: async () => undefined, set: async () => {}, delete: async () => {} },
    redact: (text) => text.replaceAll('AT-1', '***'),
  };
  return { ctx, calls, accessToken };
}
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers });
const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof ConnectorError ? e : String(e);
  }
  return undefined;
};

describe('readCurrentlyPlaying', () => {
  it('asks for episodes too and sends the bearer token', async () => {
    const { ctx, calls } = ctxWith([json(200, TRACK)]);
    expect(await readCurrentlyPlaying(ctx)).toMatchObject({ title: 'Testlied' });
    expect(calls[0]).toEqual({
      url: 'https://api.spotify.com/v1/me/player/currently-playing?additional_types=episode',
      method: 'GET',
      auth: 'Bearer AT-1',
    });
  });

  it('204 means nothing is playing', async () => {
    const { ctx } = ctxWith([new Response(null, { status: 204 })]);
    expect(await readCurrentlyPlaying(ctx)).toBeUndefined();
  });

  it('401 gets a fresh token and one more try, a second 401 is "expired"', async () => {
    const ok = ctxWith([json(401, { error: { status: 401 } }), json(200, TRACK)]);
    expect(await readCurrentlyPlaying(ok.ctx)).toMatchObject({ title: 'Testlied' });
    expect(ok.accessToken.mock.calls).toEqual([[undefined], [{ refresh: true }]]);
    expect(ok.calls.map((c) => c.auth)).toEqual(['Bearer AT-1', 'Bearer AT-2']);

    const bad = ctxWith([json(401, {}), json(401, {})]);
    expect((await codeOf(readCurrentlyPlaying(bad.ctx))) as ConnectorError).toMatchObject({
      code: 'expired',
    });
    expect(bad.calls).toHaveLength(2);
  });

  it('429 carries Retry-After', async () => {
    const { ctx } = ctxWith([json(429, {}, { 'retry-after': '17' })]);
    expect(await codeOf(readCurrentlyPlaying(ctx))).toMatchObject({
      code: 'rate-limited',
      retryAfter: 17,
    });
  });

  it('maps 403, server errors and network failures without leaking the token', async () => {
    expect(await codeOf(readCurrentlyPlaying(ctxWith([json(403, {})]).ctx))).toMatchObject({
      code: 'denied',
    });
    expect(await codeOf(readCurrentlyPlaying(ctxWith([json(503, {})]).ctx))).toMatchObject({
      code: 'network',
    });
    const failed = (await codeOf(
      readCurrentlyPlaying(ctxWith([new TypeError('failed with AT-1')]).ctx),
    )) as ConnectorError;
    expect(failed.code).toBe('network');
    expect(failed.message).not.toContain('AT-1');
  });
});

describe('sendCommand', () => {
  it('uses PUT for pause and play and POST for next', async () => {
    const { ctx, calls } = ctxWith([
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
    ]);
    await sendCommand(ctx, 'pause');
    await sendCommand(ctx, 'play');
    await sendCommand(ctx, 'next');
    expect(
      calls.map((c) => `${c.method} ${c.url.replace('https://api.spotify.com/v1/me/player', '')}`),
    ).toEqual(['PUT /pause', 'PUT /play', 'POST /next']);
  });

  it('403 PREMIUM_REQUIRED is its own error', async () => {
    const { ctx } = ctxWith([
      json(403, {
        error: { status: 403, reason: 'PREMIUM_REQUIRED', message: 'Premium required' },
      }),
    ]);
    expect(await codeOf(sendCommand(ctx, 'pause'))).toMatchObject({ code: 'premium-required' });
  });

  it('404 (no active device) is a quiet bad-response', async () => {
    const { ctx } = ctxWith([json(404, { error: { reason: 'NO_ACTIVE_DEVICE' } })]);
    expect(await codeOf(sendCommand(ctx, 'next'))).toMatchObject({ code: 'bad-response' });
  });
});

describe('listPlaylists', () => {
  it('reads id and name, skips empty slots and odd ids', async () => {
    const { ctx, calls } = ctxWith([
      json(200, {
        items: [
          { id: 'pl1ABC', name: 'Fokus' },
          null,
          { id: 'bad id!', name: 'x' },
          { id: 'pl2DEF', name: 'y'.repeat(300) },
        ],
      }),
    ]);
    const lists = await listPlaylists(ctx);
    expect(lists.map((l) => l.id)).toEqual(['pl1ABC', 'pl2DEF']);
    expect(lists[1]!.name).toHaveLength(200);
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/me/playlists?limit=50');
  });

  it('follows the next links up to four pages and never leaves the API host', async () => {
    const page = (n: number, next: string | null) =>
      json(200, { items: [{ id: `pl${n}`, name: `Liste ${n}` }], next });
    const four = ctxWith([
      page(1, 'https://api.spotify.com/v1/me/playlists?offset=50&limit=50'),
      page(2, 'https://api.spotify.com/v1/me/playlists?offset=100&limit=50'),
      page(3, 'https://api.spotify.com/v1/me/playlists?offset=150&limit=50'),
      page(4, 'https://api.spotify.com/v1/me/playlists?offset=200&limit=50'),
      page(5, null),
    ]);
    expect((await listPlaylists(four.ctx)).map((l) => l.id)).toEqual(['pl1', 'pl2', 'pl3', 'pl4']);
    expect(four.calls).toHaveLength(4);

    const foreign = ctxWith([page(1, 'https://evil.example.test/steal'), page(2, null)]);
    expect((await listPlaylists(foreign.ctx)).map((l) => l.id)).toEqual(['pl1']);
    expect(foreign.calls).toHaveLength(1);
  });

  it('an unexpected shape is an empty list, a missing scope is "denied"', async () => {
    expect(await listPlaylists(ctxWith([json(200, { nope: 1 })]).ctx)).toEqual([]);
    expect(await codeOf(listPlaylists(ctxWith([json(403, {})]).ctx))).toMatchObject({
      code: 'denied',
    });
  });
});

describe('startPlaylist', () => {
  it('plays the playlist as a context on the active device', async () => {
    const seen: { url: string; body?: string; type?: string }[] = [];
    const { ctx } = ctxWith([new Response(null, { status: 204 })]);
    const inner = ctx.fetch;
    ctx.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({
        url: String(input),
        body: init?.body as string,
        type: (init?.headers as Record<string, string>)['content-type'],
      });
      return inner(input, init);
    }) as typeof fetch;
    await startPlaylist(ctx, 'pl1ABC');
    expect(seen).toEqual([
      {
        url: 'https://api.spotify.com/v1/me/player/play',
        body: '{"context_uri":"spotify:playlist:pl1ABC"}',
        type: 'application/json',
      },
    ]);
  });

  it('refuses an id that is not base 62 and reports Premium and a missing device', async () => {
    const { ctx, calls } = ctxWith([]);
    expect(await codeOf(startPlaylist(ctx, 'x"y'))).toMatchObject({ code: 'bad-response' });
    expect(calls).toEqual([]);
    const premium = ctxWith([json(403, { error: { reason: 'PREMIUM_REQUIRED' } })]);
    expect(await codeOf(startPlaylist(premium.ctx, 'ok1'))).toMatchObject({
      code: 'premium-required',
    });
    const none = ctxWith([json(404, { error: { reason: 'NO_ACTIVE_DEVICE' } })]);
    expect(await codeOf(startPlaylist(none.ctx, 'ok1'))).toMatchObject({ code: 'bad-response' });
  });
});

describe('widget data of the reading', () => {
  const FULL = {
    ...TRACK,
    progress_ms: 61_000,
    item: {
      ...TRACK.item,
      duration_ms: 215_000,
      album: {
        name: 'Erfundenes Album',
        images: [
          { url: 'https://i.scdn.co/image/large1', width: 640 },
          { url: 'https://i.scdn.co/image/mid2', width: 300 },
          { url: 'https://i.scdn.co/image/small3', width: 64 },
        ],
      },
    },
  };

  it('reads album, position, length and the smallest cover that is wide enough', () => {
    expect(parseCurrentlyPlaying(FULL)).toMatchObject({
      album: 'Erfundenes Album',
      progressMs: 61_000,
      durationMs: 215_000,
      coverUrl: 'https://i.scdn.co/image/small3',
    });
  });

  it("accepts covers from Spotify's image host only", () => {
    const odd = {
      ...FULL,
      item: {
        ...FULL.item,
        album: { name: 'A', images: [{ url: 'https://evil.test/image/x', width: 300 }] },
      },
    };
    expect(parseCurrentlyPlaying(odd)!.coverUrl).toBeUndefined();
    expect(COVER_URL.test('https://i.scdn.co/image/ab67616d')).toBe(true);
    expect(COVER_URL.test('http://i.scdn.co/image/ab')).toBe(false);
    expect(COVER_URL.test('https://i.scdn.co.evil.test/image/ab')).toBe(false);
  });

  it('an episode has no album; its picture comes from the episode', () => {
    const out = parseCurrentlyPlaying({
      ...EPISODE,
      item: { ...EPISODE.item, images: [{ url: 'https://i.scdn.co/image/ep1', width: 300 }] },
    })!;
    expect(out.album).toBeUndefined();
    expect(out.coverUrl).toBe('https://i.scdn.co/image/ep1');
  });
});

describe('player state and settings', () => {
  it('reads device, volume, shuffle and repeat; 204 is "no device"', async () => {
    const { ctx, calls } = ctxWith([
      json(200, {
        device: { name: 'Küche', volume_percent: 40 },
        shuffle_state: true,
        repeat_state: 'context',
      }),
      new Response(null, { status: 204 }),
    ]);
    expect(await readPlayerState(ctx)).toEqual({
      device: 'Küche',
      volume: 40,
      shuffle: true,
      repeat: 'context',
    });
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/me/player');
    expect(await readPlayerState(ctx)).toBeUndefined();
  });

  it('seek, volume, shuffle and repeat are PUTs with clamped, rounded values', async () => {
    const { ctx, calls } = ctxWith([
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
      new Response(null, { status: 204 }),
    ]);
    await seek(ctx, -5);
    await setVolume(ctx, 140.4);
    await setShuffle(ctx, true);
    await setRepeat(ctx, 'track');
    expect(
      calls.map((c) => `${c.method} ${c.url.replace('https://api.spotify.com/v1/me/player', '')}`),
    ).toEqual([
      'PUT /seek?position_ms=0',
      'PUT /volume?volume_percent=100',
      'PUT /shuffle?state=true',
      'PUT /repeat?state=track',
    ]);
  });

  it('"previous" is a POST', async () => {
    const { ctx, calls } = ctxWith([new Response(null, { status: 204 })]);
    await sendCommand(ctx, 'previous');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.spotify.com/v1/me/player/previous',
    });
  });
});

describe('search, saved songs and play', () => {
  it('asks only for words of two letters or more and sends them URL-encoded', async () => {
    const empty = ctxWith([]);
    expect(await search(empty.ctx, ' a ')).toEqual({ tracks: [], playlists: [], albums: [] });
    expect(empty.calls).toHaveLength(0);

    const { ctx, calls } = ctxWith([
      json(200, {
        tracks: { items: [{ id: 'T1', name: 'Lied', artists: [{ name: 'Band' }] }, null] },
        playlists: { items: [null, { id: 'P1', name: 'Liste' }] },
        albums: {
          items: [
            { id: 'A1', name: 'Album', artists: [{ name: 'Band' }] },
            { id: 'bad id!', name: 'x' },
          ],
        },
      }),
    ]);
    const out = await search(ctx, 'Rage & Fire');
    expect(calls[0]!.url).toContain('https://api.spotify.com/v1/search?q=Rage+%26+Fire');
    expect(calls[0]!.url).toContain('type=track%2Cplaylist%2Calbum');
    expect(out.tracks).toEqual([{ kind: 'track', id: 'T1', name: 'Lied', subtitle: 'Band' }]);
    expect(out.playlists).toEqual([
      { kind: 'playlist', id: 'P1', name: 'Liste', subtitle: undefined },
    ]);
    expect(out.albums.map((a) => a.id)).toEqual(['A1']);
  });

  it('lists the saved songs and drops entries without an id', async () => {
    const { ctx, calls } = ctxWith([
      json(200, {
        items: [
          { track: { id: 'T1', name: 'Eins', artists: [{ name: 'Band' }] } },
          { track: { id: null, name: 'Lokal' } },
          null,
          { track: { id: 'T2', name: 'Zwei' } },
        ],
      }),
    ]);
    const out = await likedSongs(ctx);
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/me/tracks?limit=50');
    expect(out.map((t) => t.id)).toEqual(['T1', 'T2']);
  });

  it('starts a track inside its list, a playlist or album as a context, and refuses odd ids', async () => {
    const replies = () => [new Response(null, { status: 204 })];
    const track = ctxWith(replies());
    const list = [
      { kind: 'track' as const, id: 'T1', name: 'Eins' },
      { kind: 'track' as const, id: 'T2', name: 'Zwei' },
    ];
    await play(track.ctx, list[1]!, list);
    expect(track.calls[0]!.method).toBe('PUT');
    const sent = ctxWith(replies());
    await play(sent.ctx, { kind: 'playlist', id: 'P1', name: 'Liste' });
    await play(ctxWith(replies()).ctx, { kind: 'album', id: 'A1', name: 'Album' });
    expect(sent.calls[0]!.url).toBe('https://api.spotify.com/v1/me/player/play');
    expect(
      await codeOf(play(ctxWith([]).ctx, { kind: 'track', id: 'x/../y', name: 'bad' })),
    ).toMatchObject({
      code: 'bad-response',
    });
  });
});

describe('play bodies', () => {
  const bodies: unknown[] = [];
  const ctx: ConnectorContext = {
    fetch: (async (_url: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(JSON.parse(String(init?.body)));
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    accessToken: async () => 'AT',
    fetchPublic: async () => new Response(),
    secrets: { get: async () => undefined, set: async () => {}, delete: async () => {} },
    redact: (t) => t,
  };

  it('a track starts inside its list at its own position; playlists and albums are contexts', async () => {
    const list = [
      { kind: 'track' as const, id: 'T1', name: 'Eins' },
      { kind: 'track' as const, id: 'T2', name: 'Zwei' },
      { kind: 'track' as const, id: 'T3', name: 'Drei' },
    ];
    await play(ctx, list[1]!, list);
    await play(ctx, list[0]!);
    await play(ctx, { kind: 'playlist', id: 'P1', name: 'Liste' });
    await play(ctx, { kind: 'album', id: 'A1', name: 'Album' });
    expect(bodies).toEqual([
      {
        uris: ['spotify:track:T1', 'spotify:track:T2', 'spotify:track:T3'],
        offset: { position: 1 },
      },
      { uris: ['spotify:track:T1'], offset: { position: 0 } },
      { context_uri: 'spotify:playlist:P1' },
      { context_uri: 'spotify:album:A1' },
    ]);
  });
});
