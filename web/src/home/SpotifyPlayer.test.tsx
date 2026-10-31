// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetAccessToken } from '@/core/connectors/context';
import { HIDDEN_KEY } from '@/core/connectors/hiddenTracks';
import { saveStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { NowPlayingLine } from './NowPlayingLine';

const PLAYING = {
  is_playing: true,
  currently_playing_type: 'track',
  progress_ms: 61_000,
  item: {
    name: 'Jetztlied',
    artists: [{ name: 'Erfundene Band' }],
    album: { name: 'Erfundenes Album' },
    duration_ms: 215_000,
    external_urls: { spotify: 'https://open.spotify.com/track/cur111' },
  },
};
const T = (id: string, name: string, ms = 200_000) => ({
  track: {
    id,
    name,
    type: 'track',
    duration_ms: ms,
    artists: [{ name: 'Band' }],
    album: { name: 'Album A' },
  },
});
const PLAYLIST = {
  name: 'Fokus',
  owner: { display_name: 'Ich' },
  tracks: { total: 3, items: [T('s1', 'Eins', 185_000), T('s2', 'Zwei'), T('s3', 'Drei')] },
};

const secrets = new Map<string, string>([
  ['oauth:spotify:client-id', 'client-invented-123'],
  ['oauth:spotify:refresh', 'RT-invented'],
]);
interface Call {
  method: string;
  path: string;
  body?: string;
}
const calls: Call[] = [];
let router: (call: Call) => unknown | Response | undefined;
let savedAnswer: boolean[] = [true, false, false];

function install() {
  const web = createWebPlatform();
  const platform: PlatformService = {
    ...web,
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://accounts.spotify.com/api/token')
        return new Response(JSON.stringify({ access_token: 'AT-invented', expires_in: 3600 }));
      const call: Call = {
        method: init?.method ?? 'GET',
        path: url.replace('https://api.spotify.com/v1', ''),
        body: init?.body as string | undefined,
      };
      calls.push(call);
      if (call.path.startsWith('/me/player/currently-playing'))
        return new Response(JSON.stringify(PLAYING));
      const hit = router(call);
      if (hit instanceof Response) return hit;
      if (hit !== undefined) return new Response(JSON.stringify(hit));
      if (call.path === '/me/player')
        return call.method === 'GET'
          ? new Response(
              JSON.stringify({
                device: { name: 'Küche', volume_percent: 40 },
                shuffle_state: false,
                repeat_state: 'off',
              }),
            )
          : new Response(null, { status: 204 });
      if (call.path.startsWith('/playlists/PL1')) return new Response(JSON.stringify(PLAYLIST));
      if (call.path.startsWith('/me/playlists'))
        return new Response(JSON.stringify({ items: [{ id: 'PL1', name: 'Fokus' }] }));
      if (call.path.startsWith('/me/tracks/contains'))
        return new Response(JSON.stringify(savedAnswer));
      if (call.path.startsWith('/me/player/devices'))
        return new Response(
          JSON.stringify({
            devices: [
              { id: 'dev1', name: 'Küche', type: 'Speaker', is_active: true, volume_percent: 40 },
              { id: 'dev2', name: 'Büro-PC', type: 'Computer', is_active: false },
            ],
          }),
        );
      return new Response(null, { status: 204 });
    }) as typeof fetch,
    secrets: {
      protection: 'device-key',
      get: async (name) => secrets.get(name),
      set: async (name, value) => void secrets.set(name, value),
      delete: async (name) => void secrets.delete(name),
    },
  };
  setPlatform(platform);
}

const FEATURES = ['show', 'control', 'playlists', 'library', 'history'];
const connect = (features = FEATURES) => saveStatus('spotify', { state: 'connected', features });
const sent = (method: string, prefix: string) =>
  calls.filter((c) => c.method === method && c.path.startsWith(prefix));

async function openPlaylist() {
  render(
    <MemoryRouter>
      <NowPlayingLine />
    </MemoryRouter>,
  );
  await screen.findByTestId('now-playing-line');
  fireEvent.click(screen.getByTestId('now-playing-open'));
  await screen.findByTestId('spotify-player');
  fireEvent.click(await screen.findByRole('button', { name: /Fokus/ }));
  await screen.findByRole('button', { name: 'Zwei abspielen' });
}

beforeEach(async () => {
  calls.length = 0;
  router = () => undefined;
  savedAnswer = [true, false, false];
  localStorage.clear();
  forgetAccessToken('spotify');
  install();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setPlatform(undefined);
});

describe('Spotify player', () => {
  it('opening a playlist lists every song with artist, album and length, and plays nothing', async () => {
    await connect();
    await openPlaylist();
    const rows = screen.getAllByTestId('track-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Eins');
    expect(rows[0]).toHaveTextContent('Band');
    expect(rows[0]).toHaveTextContent('Album A');
    expect(rows[0]).toHaveTextContent('3:05');
    expect(screen.getByRole('heading', { name: 'Fokus' })).toBeTruthy();
    expect(screen.getByTestId('spotify-player')).toHaveTextContent('3 Titel');
    expect(sent('PUT', '/me/player/play')).toEqual([]);
  });

  it('a tap on a song plays it inside its playlist; "Abspielen" plays the playlist itself', async () => {
    await connect();
    await openPlaylist();
    fireEvent.click(screen.getByRole('button', { name: 'Zwei abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toEqual({
      context_uri: 'spotify:playlist:PL1',
      offset: { uri: 'spotify:track:s2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(2));
    expect(JSON.parse(sent('PUT', '/me/player/play')[1]!.body!)).toEqual({
      context_uri: 'spotify:playlist:PL1',
    });
  });

  it('the heart shows which songs are saved and saves or removes one', async () => {
    await connect();
    await openPlaylist();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Eins aus Lieblingssongs entfernen' }),
      ).toBeTruthy(),
    );
    expect(sent('GET', '/me/tracks/contains').some((c) => c.path.includes('ids=s1,s2,s3'))).toBe(
      true,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zwei zu Lieblingssongs hinzufügen' }));
    await waitFor(() => expect(sent('PUT', '/me/tracks')).toHaveLength(1));
    expect(sent('PUT', '/me/tracks')[0]!.path).toBe('/me/tracks?ids=s2');
    expect(screen.getByRole('button', { name: 'Zwei aus Lieblingssongs entfernen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Eins aus Lieblingssongs entfernen' }));
    await waitFor(() => expect(sent('DELETE', '/me/tracks')).toHaveLength(1));
    expect(sent('DELETE', '/me/tracks')[0]!.path).toBe('/me/tracks?ids=s1');
  });

  it('a refused save is taken back and says how to get the permission', async () => {
    await connect();
    router = (c) =>
      c.method === 'PUT' && c.path.startsWith('/me/tracks')
        ? new Response('{}', { status: 403 })
        : undefined;
    await openPlaylist();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Zwei zu Lieblingssongs hinzufügen' }),
    );
    expect(await screen.findByText(/neu ankreuzen/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Zwei zu Lieblingssongs hinzufügen' })).toBeTruthy();
  });

  it('without the "Lieblingssongs" feature there is no heart and nothing is asked', async () => {
    await connect(['show', 'control', 'playlists']);
    await openPlaylist();
    expect(screen.queryByRole('button', { name: /Lieblingssongs hinzufügen/ })).toBeNull();
    expect(sent('GET', '/me/tracks/contains')).toEqual([]);
  });

  it('a song can be hidden in its playlist: gone from the list, remembered by id, skipped by "Abspielen"', async () => {
    await connect();
    await openPlaylist();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Zwei' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'In dieser Liste ausblenden' }));
    await waitFor(() => expect(screen.getAllByTestId('track-row')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Zwei abspielen' })).toBeNull();
    expect(localStorage.getItem(HIDDEN_KEY)).toBe('{"PL1":["s2"]}');
    const dialog = screen.getByTestId('spotify-player');
    expect(dialog).toHaveTextContent('1 ausgeblendet');
    expect(dialog).toHaveTextContent('Bei Spotify bleibt alles, wie es ist');

    // Play now uses the visible songs as the list, so the hidden one is skipped.
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toEqual({
      uris: ['spotify:track:s1', 'spotify:track:s3'],
      offset: { position: 0 },
    });

    // Show them again: the row is back (marked), and can be un-hidden.
    fireEvent.click(screen.getByRole('button', { name: 'Ausgeblendete zeigen' }));
    expect(screen.getAllByTestId('track-row')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Zwei' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Wieder einblenden' }));
    await waitFor(() => expect(localStorage.getItem(HIDDEN_KEY)).toBeNull());
  });

  it('the menu adds a song to the queue', async () => {
    await connect();
    await openPlaylist();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Drei' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Zur Warteschlange hinzufügen' }));
    await waitFor(() => expect(sent('POST', '/me/player/queue')).toHaveLength(1));
    expect(decodeURIComponent(sent('POST', '/me/player/queue')[0]!.path)).toContain(
      'spotify:track:s3',
    );
  });

  it('the queue view shows what plays and what comes next', async () => {
    await connect();
    router = (c) =>
      c.path === '/me/player/queue'
        ? {
            currently_playing: T('cur111', 'Jetztlied').track,
            queue: [T('q1', 'Danach').track, T('q2', 'Dannach').track],
          }
        : undefined;
    render(
      <MemoryRouter>
        <NowPlayingLine />
      </MemoryRouter>,
    );
    await screen.findByTestId('now-playing-line');
    fireEvent.click(screen.getByTestId('now-playing-open'));
    fireEvent.click(await screen.findByRole('button', { name: /Warteschlange/ }));
    const dialog = screen.getByTestId('spotify-player');
    await waitFor(() => expect(dialog).toHaveTextContent('Als Nächstes'));
    await waitFor(() => expect(within(dialog).getAllByTestId('track-row').length).toBe(3));
    expect(dialog).toHaveTextContent('Danach');
    expect(dialog).toHaveTextContent('Dannach');
  });

  it('the bar names the song with album, offers a heart for it and moves the music to another device', async () => {
    await connect();
    render(
      <MemoryRouter>
        <NowPlayingLine />
      </MemoryRouter>,
    );
    await screen.findByTestId('now-playing-line');
    fireEvent.click(screen.getByTestId('now-playing-open'));
    const dialog = await screen.findByTestId('spotify-player');
    await waitFor(() => expect(dialog).toHaveTextContent('Erfundene Band · Erfundenes Album'));
    expect(
      await screen.findByRole('button', { name: 'Jetztlied aus Lieblingssongs entfernen' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Geräte' }));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Küche · aktiv' }));
    fireEvent.click(screen.getByRole('button', { name: 'Geräte' }));
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Auf Büro-PC abspielen' }));
    await waitFor(() =>
      expect(sent('PUT', '/me/player').find((c) => c.body?.includes('dev2'))).toBeTruthy(),
    );
  });

  it('"Zuletzt gespielt" lists the recent songs', async () => {
    await connect();
    router = (c) =>
      c.path.startsWith('/me/player/recently-played')
        ? { items: [{ track: T('h1', 'Gestern').track }, { track: T('h2', 'Vorgestern').track }] }
        : undefined;
    render(
      <MemoryRouter>
        <NowPlayingLine />
      </MemoryRouter>,
    );
    await screen.findByTestId('now-playing-line');
    fireEvent.click(screen.getByTestId('now-playing-open'));
    fireEvent.click(await screen.findByRole('button', { name: /Zuletzt gespielt/ }));
    expect(await screen.findByRole('button', { name: 'Gestern abspielen' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Vorgestern abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toMatchObject({
      uris: ['spotify:track:h1', 'spotify:track:h2'],
      offset: { position: 1 },
    });
  });
});
