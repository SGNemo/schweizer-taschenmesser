// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetAccessToken } from '@/core/connectors/context';
import { HIDDEN_KEY } from '@/core/connectors/hiddenTracks';
import { NOW_KEY, NO_PREMIUM_KEY } from '@/core/connectors/nowPlaying';
import { loadStatus, saveStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import manifest from '../manifest';
import { clearCovers } from '../coverLoader';
import { forgetRecent } from '../recentOnce';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { AreaFrame } from '@/layout/AreaFrame';
import { useUiStore } from '@/stores/ui';
import MusicPage from '../routes/MusicPage';
import NowPlayingWidget from '../widgets/NowPlayingWidget';

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
let player: () => Response;
let playerState: () => Response;
let savedAnswer: boolean[] = [true, false, false];
const opened: string[] = [];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const empty204 = () => new Response(null, { status: 204 });

function install() {
  const web = createWebPlatform();
  const platform: PlatformService = {
    ...web,
    kind: 'desktop',
    isNative: true,
    app: { ...web.app, openUrl: async (url: string) => void opened.push(url) },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://accounts.spotify.com/api/token')
        return json({ access_token: 'AT-invented', expires_in: 3600 });
      const call: Call = {
        method: init?.method ?? 'GET',
        path: url.replace('https://api.spotify.com/v1', ''),
        body: init?.body as string | undefined,
      };
      calls.push(call);
      if (call.path.startsWith('/me/player/currently-playing')) return player();
      const hit = router(call);
      if (hit instanceof Response) return hit;
      if (hit !== undefined) return json(hit);
      if (call.path === '/me/player') return call.method === 'GET' ? playerState() : empty204();
      if (call.path.startsWith('/playlists/PL1')) return json(PLAYLIST);
      if (call.path.startsWith('/me/playlists'))
        return json({ items: [{ id: 'PL1', name: 'Fokus' }] });
      if (call.path.startsWith('/me/tracks/contains')) return json(savedAnswer);
      if (call.path.startsWith('/me/player/devices'))
        return json({
          devices: [
            { id: 'dev1', name: 'Küche', type: 'Speaker', is_active: true, volume_percent: 40 },
            { id: 'dev2', name: 'Büro-PC', type: 'Computer', is_active: false },
          ],
        });
      return empty204();
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
const requested = () => calls.map((c) => `${c.method} ${c.path}`);

const renderWidget = () =>
  render(
    <MemoryRouter>
      <NowPlayingWidget />
    </MemoryRouter>,
  );
/** The page sits in the module frame like in the app: the head's slots (cover, player, tint) need it. */
async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/music']}>
      <AreaFrame>
        <MusicPage />
      </AreaFrame>
    </MemoryRouter>,
  );
  await screen.findByTestId('module-frame'); // the page re-mounts once when the module frame is known
}
const main = () => screen.getByTestId('music-main');
async function openPlaylist() {
  await renderPage();
  fireEvent.click(await screen.findByRole('button', { name: /Fokus/ }));
  await screen.findByRole('button', { name: 'Zwei abspielen' });
}
/** The chips of the toolbar (the library in the aside has the same names). */
const chip = (name: RegExp | string) =>
  within(screen.getByRole('navigation', { name: 'Ansichten' })).getByRole('button', { name });

beforeEach(async () => {
  calls.length = 0;
  opened.length = 0;
  router = () => undefined;
  player = () => json(PLAYING);
  playerState = () =>
    json({
      device: { name: 'Küche', volume_percent: 40 },
      shuffle_state: false,
      repeat_state: 'off',
    });
  savedAnswer = [true, false, false];
  localStorage.clear();
  forgetAccessToken('spotify');
  install();
  await db.table('_meta').clear();
  // A preview module is off by default: the user switches it on in the library.
  await enableModule(manifest);
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  setPlatform(undefined);
  clearCovers();
  forgetRecent();
  vi.unstubAllGlobals();
});

describe('music widget (overview)', () => {
  it('not connected: one calm next step, nothing is asked', async () => {
    renderWidget();
    expect(await screen.findByText('Verbinde Spotify')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Spotify verbinden' })).toHaveAttribute(
      'href',
      '/settings/verbindungen',
    );
    await new Promise((r) => setTimeout(r, 60));
    expect(requested()).toEqual([]);
  });

  it('shows title and artist; the last reading is kept on this device only', async () => {
    await connect();
    renderWidget();
    const w = await screen.findByTestId('music-widget');
    await waitFor(() => expect(w).toHaveTextContent('Jetztlied'));
    expect(w).toHaveTextContent('Erfundene Band');
    expect(JSON.parse(localStorage.getItem(NOW_KEY)!).value.title).toBe('Jetztlied');
  });

  it('nothing plays (204): one quiet line, and the stored reading is forgotten', async () => {
    await connect();
    player = empty204;
    localStorage.setItem(
      NOW_KEY,
      JSON.stringify({ at: Date.now(), value: { title: 'Alt', artist: 'x', playing: true } }),
    );
    renderWidget();
    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    await waitFor(() =>
      expect(screen.getByTestId('music-widget')).toHaveTextContent('Gerade läuft nichts.'),
    );
    expect(localStorage.getItem(NOW_KEY)).toBeNull();
  });

  it('without "Anzeigen" it looks like not connected, even with the control scope', async () => {
    await connect(['control']);
    renderWidget();
    expect(await screen.findByText('Verbinde Spotify')).toBeTruthy();
    await new Promise((r) => setTimeout(r, 60));
    expect(requested()).toEqual([]);
  });

  it('pauses and resumes, and asks for the next track', async () => {
    await connect();
    renderWidget();
    const toggle = await screen.findByTestId('now-playing-toggle');
    expect(toggle).toHaveAttribute('aria-label', 'Pause');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByTestId('now-playing-toggle')).toHaveAttribute('aria-label', 'Weiter'),
    );
    fireEvent.click(screen.getByTestId('now-playing-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('now-playing-toggle')).toHaveAttribute('aria-label', 'Pause'),
    );
    fireEvent.click(screen.getByTestId('now-playing-next'));
    await waitFor(() => expect(requested()).toContain('POST /me/player/next'));
    expect(requested()).toContain('PUT /me/player/pause');
    expect(requested()).toContain('PUT /me/player/play');
  });

  it('shows no controls without the "Steuern" feature', async () => {
    await connect(['show']);
    renderWidget();
    await screen.findByTestId('music-widget');
    expect(screen.queryByTestId('now-playing-toggle')).toBeNull();
    expect(screen.queryByTestId('now-playing-next')).toBeNull();
  });

  it('without Premium: hides the controls, says so once and keeps the display', async () => {
    await connect();
    router = (c) =>
      c.path.startsWith('/me/player/pause') || c.path.startsWith('/me/player/play')
        ? json({ error: { status: 403, reason: 'PREMIUM_REQUIRED' } }, 403)
        : undefined;
    renderWidget();
    fireEvent.click(await screen.findByTestId('now-playing-toggle'));
    await waitFor(() => expect(screen.queryByTestId('now-playing-toggle')).toBeNull());
    expect(screen.getByTestId('music-widget')).toHaveTextContent('Jetztlied');
    expect(useUiStore.getState().toasts.map((x) => x.message)).toEqual([
      'Steuern braucht Spotify Premium.',
    ]);
    expect(localStorage.getItem(NO_PREMIUM_KEY)).not.toBeNull();
    cleanup();
    useUiStore.setState({ toasts: [] });
    renderWidget();
    await screen.findByTestId('music-widget');
    expect(screen.queryByTestId('now-playing-toggle')).toBeNull();
    expect(useUiStore.getState().toasts).toEqual([]);
  });

  it('marks the connection expired when Spotify rejects the sign-in, and the widget offers to connect again', async () => {
    await connect();
    player = () => json({}, 401);
    renderWidget();
    await waitFor(async () => expect((await loadStatus('spotify')).state).toBe('expired'));
    await waitFor(() => expect(screen.queryByTestId('music-widget')).toBeNull());
  });

  it('keeps the last reading and says nothing when Spotify cannot be reached', async () => {
    await connect();
    player = () => json({}, 503);
    localStorage.setItem(
      NOW_KEY,
      JSON.stringify({
        at: Date.now(),
        value: { title: 'Zuletzt', artist: 'Band', playing: true },
      }),
    );
    renderWidget();
    await waitFor(() => expect(requested().length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.getByTestId('music-widget')).toHaveTextContent('Zuletzt');
    expect(screen.queryByRole('alert')).toBeNull();
    expect((await loadStatus('spotify')).state).toBe('connected');
  });

  it('a thin progress bar with the position', async () => {
    await connect();
    renderWidget();
    const bar = await screen.findByRole('progressbar', { name: 'Position' });
    expect(bar).toHaveAttribute('aria-valuenow', '28');
    expect(bar).toHaveAttribute('aria-valuetext', '1:01 / 3:35');
  });
});

describe('music page', () => {
  it('not connected: one calm next step to the connections', async () => {
    await renderPage();
    const empty = await screen.findByTestId('music-empty');
    expect(empty).toHaveTextContent('Verbinde Spotify');
    expect(within(empty).getByRole('link')).toHaveAttribute('href', '/settings/verbindungen');
    expect(requested()).toEqual([]);
  });

  it('the title (h1) is "Musik", in the module head; the player and the cover sit in the head too', async () => {
    await connect();
    await renderPage();
    const frame = screen.getByTestId('module-frame');
    expect(await within(frame).findByRole('heading', { level: 1, name: 'Musik' })).toBeTruthy();
    expect(await within(frame).findByTestId('music-now')).toHaveTextContent('Jetztlied');
    expect(within(frame).getByTestId('music-cover')).toBeTruthy();
    expect(frame).toHaveAttribute('data-signature', 'coverTone');
    expect(frame).toHaveAttribute('data-head', 'stage');
  });

  it('the start view is never empty: recently played and your playlists as covers', async () => {
    await connect();
    router = (c) =>
      c.path.startsWith('/me/player/recently-played')
        ? { items: [{ track: T('h1', 'Gestern').track }, { track: T('h2', 'Vorgestern').track }] }
        : undefined;
    await renderPage();
    const start = await screen.findByTestId('music-start');
    expect(await within(start).findByRole('button', { name: /Gestern/ })).toBeTruthy();
    expect(within(start).getByRole('button', { name: /Vorgestern/ })).toBeTruthy();
    expect(
      within(screen.getByTestId('music-playlists')).getByRole('button', { name: /Fokus/ }),
    ).toBeTruthy();
    fireEvent.click(within(start).getByRole('button', { name: /Vorgestern/ }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toMatchObject({
      uris: ['spotify:track:h1', 'spotify:track:h2'],
      offset: { position: 1 },
    });
  });

  it('the start view names a missing feature instead of staying empty', async () => {
    await connect(['show', 'control']);
    await renderPage();
    const start = await screen.findByTestId('music-start');
    expect(start).toHaveTextContent('„Verlauf“');
    expect(start).toHaveTextContent('„Playlists“');
    fireEvent.click(chip(/Lieblingssongs/));
    expect(main()).toHaveTextContent('„Lieblingssongs“');
    fireEvent.click(chip(/Zuletzt gespielt/));
    expect(main()).toHaveTextContent('„Zuletzt gehört“ ankreuzen');
  });

  it('opening a playlist lists every song with artist, album and length, and plays nothing', async () => {
    await connect();
    await openPlaylist();
    const rows = screen.getAllByTestId('track-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Eins');
    expect(rows[0]).toHaveTextContent('Band');
    expect(rows[0]).toHaveTextContent('Album A');
    expect(rows[0]).toHaveTextContent('3:05');
    expect(within(main()).getByRole('heading', { name: 'Fokus' })).toBeTruthy();
    expect(main()).toHaveTextContent('3 Titel');
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

  it('without the "Lieblingssongs" feature there is no heart for a list song and nothing is asked', async () => {
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
    expect(main()).toHaveTextContent('1 ausgeblendet');
    expect(main()).toHaveTextContent('Bei Spotify bleibt alles, wie es ist');
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toEqual({
      uris: ['spotify:track:s1', 'spotify:track:s3'],
      offset: { position: 0 },
    });
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

  it('the queue view shows what plays and what comes next; the aside shows the next songs', async () => {
    await connect();
    router = (c) =>
      c.path === '/me/player/queue'
        ? {
            currently_playing: T('cur111', 'Jetztlied').track,
            queue: [T('q1', 'Danach').track, T('q2', 'Dannach').track],
          }
        : undefined;
    await renderPage();
    const queue = await screen.findByTestId('music-queue');
    expect(queue).toHaveTextContent('Danach');
    expect(queue).toHaveTextContent('Dannach');
    fireEvent.click(chip(/Warteschlange/));
    await waitFor(() => expect(main()).toHaveTextContent('Als Nächstes'));
    await waitFor(() => expect(within(main()).getAllByTestId('track-row').length).toBe(3));
  });

  it('the head names the song with album, offers a heart for it and moves the music to another device', async () => {
    await connect();
    await renderPage();
    const now = await screen.findByTestId('music-now');
    await waitFor(() => expect(now).toHaveTextContent('Erfundene Band · Erfundenes Album'));
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
    await renderPage();
    await screen.findByTestId('music-start');
    fireEvent.click(chip(/Zuletzt gespielt/));
    expect(await within(main()).findByRole('button', { name: 'Gestern abspielen' })).toBeTruthy();
    fireEvent.click(within(main()).getByRole('button', { name: 'Vorgestern abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toMatchObject({
      uris: ['spotify:track:h1', 'spotify:track:h2'],
      offset: { position: 1 },
    });
  });

  it('the search runs on submit only, shows results by type and starts the tapped song', async () => {
    await connect();
    const searches: string[] = [];
    router = (c) => {
      if (c.path.includes('/search')) {
        searches.push(c.path);
        return {
          tracks: { items: [{ id: 'T9', name: 'Gefundenes Lied', artists: [{ name: 'Band' }] }] },
          playlists: { items: [] },
          albums: { items: [] },
        };
      }
      return undefined;
    };
    await renderPage();
    await screen.findByTestId('music-start');
    fireEvent.click(chip(/^Suchen$/));
    const input = within(main()).getByLabelText('Titel, Playlist oder Album suchen');
    fireEvent.change(input, { target: { value: 'Fe' } });
    fireEvent.change(input, { target: { value: 'Feuer' } });
    expect(searches).toHaveLength(0);
    fireEvent.submit(input.closest('form')!);
    const results = await screen.findByTestId('spotify-results');
    expect(searches).toHaveLength(1);
    expect(searches[0]).toContain('q=Feuer');
    expect(results).toHaveTextContent('Gefundenes Lied');
    fireEvent.click(screen.getByRole('button', { name: 'Gefundenes Lied abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
  });

  it('without "Steuern" the head shows what plays and says how to enable playing', async () => {
    await connect(['show']);
    await renderPage();
    const now = await screen.findByTestId('music-now');
    expect(now).toHaveTextContent('„Steuern“ ankreuzen');
    expect(screen.queryByTestId('player-toggle')).toBeNull();
  });

  describe('no active device', () => {
    beforeEach(() => {
      player = empty204;
      playerState = empty204;
    });

    it('is a way out, not a dead end: devices to play on, the Spotify app, the web player', async () => {
      await connect();
      await renderPage();
      const panel = await screen.findByTestId('music-nodevice');
      expect(panel).toHaveTextContent('Gerade läuft nichts');
      expect(panel).toHaveTextContent('Kein aktives Gerät');
      expect(await within(panel).findByText('Büro-PC')).toBeTruthy();
      expect(within(panel).getByRole('link', { name: /Spotify-App öffnen/ })).toHaveAttribute(
        'href',
        'spotify:',
      );
      expect(within(panel).getByRole('button', { name: 'Im Browser öffnen' })).toBeTruthy();
      // The page below is not empty either.
      expect(screen.getByTestId('music-start')).toBeTruthy();
    });

    it('in the desktop app the platform opens the Spotify link (the window does not follow custom schemes itself)', async () => {
      await connect();
      await renderPage();
      const link = await screen.findByTestId('music-open-app');
      fireEvent.click(link);
      expect(opened).toEqual(['spotify:']);
      fireEvent.click(screen.getByRole('button', { name: 'Im Browser öffnen' }));
      expect(opened).toEqual(['spotify:', 'https://open.spotify.com/']);
    });

    it('"Hier abspielen" moves the playback to that device', async () => {
      await connect();
      await renderPage();
      fireEvent.click(await screen.findByRole('button', { name: 'Hier abspielen: Büro-PC' }));
      await waitFor(() =>
        expect(sent('PUT', '/me/player').find((c) => c.body?.includes('dev2'))).toBeTruthy(),
      );
    });

    it('without "Steuern" there is no "Hier abspielen", but the Premium note and the ways to open Spotify', async () => {
      await connect(['show']);
      await renderPage();
      const panel = await screen.findByTestId('music-nodevice');
      await within(panel).findByText('Büro-PC');
      expect(within(panel).queryByRole('button', { name: /Hier abspielen/ })).toBeNull();
      expect(panel).toHaveTextContent('Steuern braucht Spotify Premium.');
      expect(within(panel).getByRole('link', { name: /Spotify-App öffnen/ })).toBeTruthy();
    });

    it('no device found at all: one sentence what to do', async () => {
      await connect();
      router = (c) => (c.path.startsWith('/me/player/devices') ? { devices: [] } : undefined);
      await renderPage();
      const panel = await screen.findByTestId('music-nodevice');
      await waitFor(() => expect(panel).toHaveTextContent('Noch kein Gerät gefunden'));
    });
  });
});

describe('covers', () => {
  const IDS = 'ab67616d00001e02ff9ca10b55ce82ae553c8228'.repeat(4);
  const MOSAIC = (w: number) => `https://mosaic.scdn.co/${w}/${IDS}`;
  const UPLOADED =
    'https://image-cdn-ak.spotifycdn.com/image/ab67706c0000da846a4e437aa6c2a667a6e7fd46';
  const ALBUM = (size: string) => `https://i.scdn.co/image/ab67616d${size}`;
  const ALBUM_IMAGES = [
    { url: ALBUM('640'), width: 640 },
    { url: ALBUM('300'), width: 300 },
    { url: ALBUM('64'), width: 64 },
  ];
  const PICTURE = () =>
    new Response(new Uint8Array(8), { status: 200, headers: { 'content-type': 'image/jpeg' } });
  const covers = () => calls.filter((c) => !c.path.startsWith('/')).map((c) => c.path);
  const withCovers = (extra: (call: Call) => unknown = () => undefined) => {
    router = (call) => {
      if (!call.path.startsWith('/')) return PICTURE();
      if (call.path.startsWith('/me/playlists'))
        return {
          items: [
            {
              id: 'PL1',
              name: 'Fokus',
              images: [640, 300, 60].map((w) => ({ url: MOSAIC(w), width: w })),
            },
            { id: 'PL2', name: 'Eigenes Bild', images: [{ url: UPLOADED, width: null }] },
            { id: 'PL3', name: 'Fremd', images: [{ url: 'https://evil.test/image/x' }] },
            { id: 'PL4', name: 'Leer', images: [] },
          ],
        };
      return extra(call);
    };
  };

  beforeEach(() => {
    let n = 0;
    URL.createObjectURL = () => `blob:test/${(n += 1)}`;
    URL.revokeObjectURL = () => undefined;
  });

  it('playlist tiles show the mosaic and the uploaded picture, sized for the tile, with the playlist name as alt text', async () => {
    withCovers();
    await connect();
    await renderPage();
    const grid = await screen.findByTestId('music-playlists');
    await waitFor(() => expect(within(grid).getAllByRole('img')).toHaveLength(2));
    expect(within(grid).getByAltText('Fokus').getAttribute('src')).toMatch(/^blob:/);
    expect(within(grid).getByAltText('Eigenes Bild').getAttribute('src')).toMatch(/^blob:/);
    // 200 CSS px at one device pixel: the 300 mosaic, not the 640 one. A foreign host and an empty playlist: the icon, no request.
    expect(covers().sort()).toEqual([MOSAIC(300), UPLOADED].sort());
    expect(within(grid).getAllByTestId('music-tile-cover')).toHaveLength(4);
  });

  it('a sharper screen takes the larger picture for the same tile', async () => {
    vi.stubGlobal('devicePixelRatio', 2);
    withCovers();
    await connect();
    await renderPage();
    await waitFor(() => expect(covers()).toContain(MOSAIC(640)));
    expect(covers()).not.toContain(MOSAIC(300));
  });

  it('a playlist opens with its picture in the header and the album picture in every row, the small size', async () => {
    withCovers((call) =>
      call.path.startsWith('/playlists/PL1')
        ? {
            ...PLAYLIST,
            images: [{ url: UPLOADED, width: null }],
            tracks: {
              total: 2,
              items: ['s1', 's2'].map((id) => ({
                track: { ...T(id, id).track, album: { name: 'Album A', images: ALBUM_IMAGES } },
              })),
            },
          }
        : undefined,
    );
    await connect();
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /Fokus/ }));
    const rows = await screen.findAllByTestId('track-row');
    await waitFor(() => expect(within(rows[0]!).getByAltText('Album A')).toBeTruthy());
    expect(within(screen.getByTestId('music-list-cover')).getByAltText('Fokus')).toBeTruthy();
    // Two rows, one album: one request for the 64 px picture, none for the larger sizes.
    expect(covers().filter((u) => u === ALBUM('64'))).toHaveLength(1);
    expect(covers()).not.toContain(ALBUM('300'));
    expect(covers()).not.toContain(ALBUM('640'));
  });

  it('nothing plays: the head shows the cover of the song played last, named as such', async () => {
    player = empty204;
    withCovers((call) =>
      call.path.startsWith('/me/player/recently-played')
        ? {
            items: [
              {
                track: {
                  ...T('r1', 'Gestern').track,
                  album: { name: 'Altes Album', images: ALBUM_IMAGES },
                },
              },
            ],
          }
        : undefined,
    );
    await connect();
    await renderPage();
    const head = await screen.findByTestId('music-cover');
    await waitFor(() =>
      expect(within(head).getByAltText('Zuletzt gespielt: Altes Album')).toBeTruthy(),
    );
    expect(screen.queryByTestId('cover-tone')).toBeNull();
    // The head and the start row share one reading of the history.
    expect(sent('GET', '/me/player/recently-played')).toHaveLength(1);
  });

  it('nothing plays and no "Verlauf" feature: the icon stays and the history is not read', async () => {
    player = empty204;
    withCovers();
    await connect(['show', 'control', 'playlists']);
    await renderPage();
    await screen.findByTestId('music-playlists');
    expect(within(screen.getByTestId('music-cover')).queryByRole('img')).toBeNull();
    expect(sent('GET', '/me/player/recently-played')).toHaveLength(0);
  });

  it('not connected: no cover is asked for, even with a stored reading that names one', async () => {
    localStorage.setItem(
      NOW_KEY,
      JSON.stringify({
        at: Date.now(),
        value: { title: 'Alt', artist: 'Band', playing: true, coverUrl: ALBUM('64') },
      }),
    );
    withCovers();
    renderWidget();
    await screen.findByText('Verbinde Spotify');
    await renderPage();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(calls).toEqual([]);
  });

  it('a row far below the visible area asks for nothing until it comes near', async () => {
    const seen: ((entries: { isIntersecting: boolean }[]) => void)[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
          seen.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    withCovers();
    await connect();
    await renderPage();
    await screen.findByTestId('music-playlists');
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(covers()).toEqual([]);
    act(() => seen.forEach((cb) => cb([{ isIntersecting: true }])));
    await waitFor(() => expect(covers()).toContain(UPLOADED));
  });
});
