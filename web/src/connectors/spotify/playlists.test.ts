import { describe, expect, it } from 'vitest';
import { ConnectorError, type ConnectorContext } from '@/core/connectors/types';
import { accountId, listPlaylists, plainText } from './api';
import { addToPlaylist, createPlaylist, editPlaylist, tracks } from './browse';

// Handwritten bodies shaped after the documented responses (no network in tests); names and ids are invented.
function ctxWith(replies: Response[]) {
  const calls: { url: string; method?: string; body?: string }[] = [];
  const ctx: ConnectorContext = {
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), method: init?.method, body: init?.body as string });
      return replies.shift() ?? new Response(null, { status: 204 });
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
const page = (from: number, count: number, next?: string) => ({
  items: Array.from({ length: count }, (_, i) => ({
    id: `pl${from + i}`,
    name: `Liste ${from + i}`,
    owner: { id: 'someone', display_name: 'Jemand' },
  })),
  next: next ?? null,
});

describe('playlists for the playlists tab', () => {
  it('reads owner id, description (as plain text) and shared editing', async () => {
    const { ctx } = ctxWith([
      json({
        items: [
          {
            id: 'plA',
            name: 'Eigene',
            description: 'Ruhig &amp; leise – <a href="spotify:artist:x">Band</a> &#x27;live&#x27;',
            collaborative: true,
            owner: { id: 'me.1', display_name: 'Ich' },
            tracks: { total: 4 },
          },
          { id: 'plB', name: 'Gefolgt', owner: { id: 'evil/../id' } },
        ],
      }),
    ]);
    const [own, followed] = await listPlaylists(ctx);
    expect(own).toMatchObject({
      id: 'plA',
      ownerId: 'me.1',
      description: "Ruhig & leise – Band 'live'",
      collaborative: true,
      trackCount: 4,
    });
    // An owner id that is not a plain id is dropped (it is never part of a request, but it is never trusted either).
    expect(followed!.ownerId).toBeUndefined();
    expect(followed!.collaborative).toBeUndefined();
  });

  it('the picker reads up to 4 pages, the tab up to 20, both only on the API host', async () => {
    const api = (n: number) => `https://api.spotify.com/v1/me/playlists?offset=${n}`;
    const replies = () =>
      Array.from({ length: 25 }, (_, i) => json(page(i * 50, 50, api((i + 1) * 50))));
    const picker = ctxWith(replies());
    expect(await listPlaylists(picker.ctx)).toHaveLength(200);
    expect(picker.calls).toHaveLength(4);
    const tab = ctxWith(replies());
    expect(await listPlaylists(tab.ctx, { all: true })).toHaveLength(1000);
    expect(tab.calls).toHaveLength(20);
    const off = ctxWith([json(page(0, 2, 'https://elsewhere.example/v1/me/playlists'))]);
    expect(await listPlaylists(off.ctx, { all: true })).toHaveLength(2);
    expect(off.calls).toHaveLength(1);
  });

  it('the account id comes from GET /me and nothing else of the profile is kept', async () => {
    const { ctx, calls } = ctxWith([
      json({ id: 'me.1', display_name: 'Ich', email: 'x@example.invalid' }),
    ]);
    expect(await accountId(ctx)).toBe('me.1');
    expect(calls[0]!.url).toBe('https://api.spotify.com/v1/me');
    const bad = ctxWith([json({ id: 'a b' })]);
    expect(await accountId(bad.ctx)).toBeUndefined();
  });

  it('plainText drops tags, decodes entities, folds space and keeps at most 300 characters', () => {
    expect(plainText(undefined)).toBeUndefined();
    expect(plainText('  <b></b> ')).toBeUndefined();
    expect(plainText('a&lt;b&gt;&#65;&nbsp;\n c &unknown;')).toBe('a<b>A c &unknown;');
    expect(plainText('x'.repeat(400))).toHaveLength(300);
  });
});

describe('a playlist with its details', () => {
  it('reads owner id, description, and each row with its place in the playlist (left-out rows count)', async () => {
    const T = (id: string) => ({ track: { id, name: `Lied ${id}`, type: 'track' } });
    const { ctx } = ctxWith([
      json({
        name: 'Fokus',
        description: 'Zum &quot;Arbeiten&quot;',
        owner: { id: 'me.1', display_name: 'Ich' },
        tracks: {
          total: 4,
          items: [T('a1'), { track: { id: 'ep1', name: 'Folge', type: 'episode' } }, T('a2')],
          next: 'https://api.spotify.com/v1/playlists/PL1/tracks?offset=3',
        },
      }),
      json({ items: [T('a3')], next: null }),
    ]);
    const list = await tracks(ctx, 'playlist', 'PL1');
    expect(list).toMatchObject({ ownerId: 'me.1', description: 'Zum "Arbeiten"' });
    expect(list.items.map((i) => [i.id, i.position])).toEqual([
      ['a1', 0],
      ['a2', 2],
      ['a3', 3],
    ]);
  });
});

describe('editing a playlist', () => {
  it('creates a private playlist with a description', async () => {
    const { ctx, calls } = ctxWith([json({ id: 'plN', name: 'Neu' }, 201)]);
    const made = await createPlaylist(ctx, ' Neu ', 'Für\nden Abend ');
    expect(made).toMatchObject({ id: 'plN', name: 'Neu', description: 'Für den Abend' });
    expect(JSON.parse(calls[0]!.body!)).toEqual({
      name: 'Neu',
      public: false,
      description: 'Für den Abend',
    });
  });

  it('changes name and description with one PUT; an empty description clears it', async () => {
    const { ctx, calls } = ctxWith([new Response(null, { status: 200 })]);
    await editPlaylist(ctx, 'plA', { name: 'Anders', description: '' });
    expect(calls[0]).toMatchObject({
      method: 'PUT',
      url: 'https://api.spotify.com/v1/playlists/plA',
    });
    expect(JSON.parse(calls[0]!.body!)).toEqual({ name: 'Anders', description: '' });
  });

  it('refuses an empty name, an empty change and a bad id without a request', async () => {
    const { ctx, calls } = ctxWith([]);
    await expect(editPlaylist(ctx, 'plA', { name: '  ' })).rejects.toBeInstanceOf(ConnectorError);
    await expect(editPlaylist(ctx, 'plA', {})).rejects.toBeInstanceOf(ConnectorError);
    await expect(editPlaylist(ctx, 'a/b', { name: 'x' })).rejects.toBeInstanceOf(ConnectorError);
    expect(calls).toHaveLength(0);
  });

  it('puts a song back at its place ("Rückgängig"); a broken place adds it at the end', async () => {
    const { ctx, calls } = ctxWith([json({}, 201), json({}, 201)]);
    await addToPlaylist(ctx, 'plA', ['t1'], 3);
    expect(JSON.parse(calls[0]!.body!)).toEqual({ uris: ['spotify:track:t1'], position: 3 });
    await addToPlaylist(ctx, 'plA', ['t1'], -1);
    expect(JSON.parse(calls[1]!.body!)).toEqual({ uris: ['spotify:track:t1'] });
  });
});
