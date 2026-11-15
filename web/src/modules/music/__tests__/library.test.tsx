// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetAccessToken } from '@/core/connectors/context';
import { saveStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { enableModule } from '@/core/modules/activation';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { AreaFrame } from '@/layout/AreaFrame';
import { useUiStore } from '@/stores/ui';
import { clearCovers } from '../coverLoader';
import { forgetLibrary } from '../library';
import manifest from '../manifest';
import { forgetRecent } from '../recentOnce';
import MusicPage from '../routes/MusicPage';

// Invented names and ids only; the fetch below answers like the Web API does (handwritten shapes).
const ME = 'me.1';
const PL = (id: string, name: string, extra: object = {}) => ({
  id,
  name,
  owner: { id: ME, display_name: 'Ich' },
  tracks: { total: 3 },
  ...extra,
});
const LISTS = [
  PL('PLa', 'Fokus', { description: 'Ruhig &amp; ohne Worte', tracks: { total: 12 } }),
  PL('PLb', 'Autofahrt', { owner: { id: 'other', display_name: 'Kim' }, tracks: { total: 40 } }),
  PL('PLc', 'Abendessen', { tracks: { total: 3 } }),
  PL('PLd', 'Gemeinsame Party', {
    owner: { id: 'other', display_name: 'Kim' },
    collaborative: true,
    tracks: { total: 7 },
  }),
];
const T = (id: string, name: string) => ({
  track: { id, name, type: 'track', duration_ms: 200_000, artists: [{ name: 'Band' }] },
});
const CONTENT = (owner: string) => ({
  name: 'Fokus',
  description: 'Ruhig &amp; ohne Worte',
  owner: { id: owner, display_name: owner === ME ? 'Ich' : 'Kim' },
  tracks: { total: 3, items: [T('s1', 'Eins'), T('s2', 'Zwei'), T('s3', 'Drei')] },
});

const ALBUM = (id: string, name: string) => ({
  id,
  name,
  artists: [{ name: 'Erfundene Band', id: 'ar1' }],
});
const TR = (id: string, name: string) => ({
  id,
  name,
  type: 'track',
  duration_ms: 200_000,
  artists: [{ name: 'Erfundene Band', id: 'ar1' }],
  album: { id: 'al1', name: 'Erstes Album' },
});
let albumSaved = false;
let RECENT: unknown[] = [];

interface Call {
  method: string;
  path: string;
  body?: string;
}
const calls: Call[] = [];
let route: (c: Call) => Response | unknown | undefined;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const empty = () => new Response(null, { status: 204 });

function install() {
  const web = createWebPlatform();
  const secrets = new Map([
    ['oauth:spotify:client-id', 'client-invented-123'],
    ['oauth:spotify:refresh', 'RT-invented'],
  ]);
  const platform: PlatformService = {
    ...web,
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://accounts.spotify.com/api/token')
        return json({ access_token: 'AT-invented', expires_in: 3600 });
      const call = {
        method: init?.method ?? 'GET',
        path: url.replace('https://api.spotify.com/v1', ''),
        body: init?.body as string | undefined,
      };
      calls.push(call);
      const hit = route(call);
      if (hit instanceof Response) return hit;
      if (hit !== undefined) return json(hit);
      if (call.path.startsWith('/me/player/currently-playing')) return empty();
      if (call.path.startsWith('/me/albums/contains')) return json([albumSaved]);
      if (call.path.startsWith('/me/albums') && call.method === 'GET')
        return json({
          items: [{ album: ALBUM('al1', 'Erstes Album') }, { album: ALBUM('al2', 'Zweites') }],
        });
      if (call.path.startsWith('/albums/al1'))
        return json({
          ...ALBUM('al1', 'Erstes Album'),
          tracks: { items: [TR('a1', 'Albumlied')] },
        });
      if (call.path === '/artists/ar1') return json({ name: 'Erfundene Band', images: [] });
      if (call.path === '/artists/ar1/top-tracks') return json({ tracks: [TR('h1', 'Hit')] });
      if (call.path.startsWith('/artists/ar1/albums'))
        return json({ items: [ALBUM('al1', 'Erstes Album')] });
      if (call.path.startsWith('/me/player/recently-played')) return json({ items: RECENT });
      if (call.path === '/me') return json({ id: ME, display_name: 'Ich' });
      if (call.path.startsWith('/me/playlists') && call.method === 'GET')
        return json({ items: LISTS, next: null });
      if (call.path.startsWith('/playlists/PLa') && call.method === 'GET') return json(CONTENT(ME));
      if (call.path.startsWith('/playlists/PLb') && call.method === 'GET')
        return json(CONTENT('other'));
      return empty();
    }) as typeof fetch,
    secrets: {
      protection: 'device-key',
      get: async (name) => secrets.get(name),
      has: async (name) => Boolean(secrets.get(name)),
      set: async (name, value) => void secrets.set(name, value),
      delete: async (name) => void secrets.delete(name),
    },
  };
  setPlatform(platform);
}

const ALL = ['show', 'control', 'playlists', 'playlistEdit', 'library', 'history'];
const connect = (features = ALL) => saveStatus('spotify', { state: 'connected', features });
const sent = (method: string, prefix: string) =>
  calls.filter((c) => c.method === method && c.path.startsWith(prefix));
const main = () => screen.getByTestId('music-main');
const tab = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Ansichten' })).getByRole('button', { name });
const titles = (testId: string) =>
  within(screen.getByTestId(testId))
    .getAllByTestId('music-tile-title')
    .map((el) => el.textContent);

async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/music']}>
      <AreaFrame>
        <MusicPage />
      </AreaFrame>
    </MemoryRouter>,
  );
  await screen.findByTestId('module-frame');
}
async function openTab(name: string) {
  await renderPage();
  fireEvent.click(await screen.findByRole('button', { name }));
  await waitFor(() => expect(tab(name)).toHaveAttribute('aria-current'));
}

beforeEach(async () => {
  calls.length = 0;
  route = () => undefined;
  albumSaved = false;
  RECENT = [];
  localStorage.clear();
  forgetAccessToken('spotify');
  forgetLibrary();
  install();
  await db.table('_meta').clear();
  await enableModule(manifest);
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  setPlatform(undefined);
  clearCovers();
  forgetRecent();
});

describe('albums tab', () => {
  it('shows the saved albums as tiles; a tile opens the album with a way back', async () => {
    await connect();
    await openTab('Alben');
    await waitFor(() => expect(titles('music-albums-grid')).toEqual(['Erstes Album', 'Zweites']));
    expect(main()).toHaveTextContent('2 Alben');
    fireEvent.click(screen.getByRole('button', { name: /^Erstes Album/ }));
    await screen.findByRole('button', { name: 'Albumlied abspielen' });
    expect(tab('Alben')).toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu den Alben' }));
    await screen.findByTestId('music-albums-grid');
  });

  it('without "Lieblingssongs" the tab names the feature and asks nothing', async () => {
    await connect(['show', 'control', 'playlists']);
    await openTab('Alben');
    expect(main()).toHaveTextContent('„Lieblingssongs“');
    expect(sent('GET', '/me/albums')).toHaveLength(0);
  });

  it('the heart on an album page saves it, and a refusal takes it back with one sentence', async () => {
    await connect();
    await openTab('Alben');
    fireEvent.click(await screen.findByRole('button', { name: /^Erstes Album/ }));
    const save = await screen.findByTestId('music-album-save');
    expect(save).toHaveAttribute('aria-pressed', 'false');
    expect(save).toHaveAccessibleName('„Erstes Album“ in deinen Alben speichern');
    fireEvent.click(save);
    await waitFor(() => expect(sent('PUT', '/me/albums?ids=al1')).toHaveLength(1));
    expect(screen.getByTestId('music-album-save')).toHaveAttribute('aria-pressed', 'true');
    route = (c) => (c.method === 'DELETE' ? json({ error: {} }, 500) : undefined);
    fireEvent.click(screen.getByTestId('music-album-save'));
    await waitFor(() =>
      expect(useUiStore.getState().toasts[0]?.message).toBe('Entfernen hat nicht geklappt.'),
    );
    expect(screen.getByTestId('music-album-save')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('artist page', () => {
  it('opens from a song menu and from the album head: most played songs and albums', async () => {
    await connect();
    await openTab('Alben');
    fireEvent.click(await screen.findByRole('button', { name: /^Erstes Album/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mehr zu Albumlied' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Zu Erfundene Band' }));
    await screen.findByRole('button', { name: 'Hit abspielen' });
    expect(screen.getByRole('heading', { name: 'Erfundene Band' })).toBeInTheDocument();
    expect(titles('music-artist-albums')).toEqual(['Erstes Album']);
    // An album opened here leads back to the artist.
    fireEvent.click(within(screen.getByTestId('music-artist-albums')).getByRole('button'));
    fireEvent.click(await screen.findByRole('button', { name: 'Zurück zu Erfundene Band' }));
    await screen.findByRole('button', { name: 'Hit abspielen' });
    fireEvent.click(screen.getByRole('button', { name: 'Abspielen' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toEqual({
      context_uri: 'spotify:artist:ar1',
    });
  });
});

describe('start view: Weiterhören', () => {
  it('shows what the recent songs were played from, each once; a tap plays on there', async () => {
    await connect();
    RECENT = [
      { track: TR('r1', 'Eins'), context: { type: 'playlist', uri: 'spotify:playlist:PLa' } },
      { track: TR('r2', 'Zwei'), context: { type: 'playlist', uri: 'spotify:playlist:PLa' } },
      { track: TR('r3', 'Drei'), context: { type: 'album', uri: 'spotify:album:al1' } },
      { track: TR('r4', 'Vier'), context: { type: 'playlist', uri: 'spotify:playlist:UNKNOWN' } },
    ];
    await renderPage();
    const row = await screen.findByTestId('music-continue');
    expect(
      within(row)
        .getAllByTestId('music-tile-title')
        .map((e) => e.textContent),
    ).toEqual(['Fokus', 'Erstes Album']);
    fireEvent.click(within(row).getByRole('button', { name: 'Erstes Album weiterhören' }));
    await waitFor(() => expect(sent('PUT', '/me/player/play')).toHaveLength(1));
    expect(JSON.parse(sent('PUT', '/me/player/play')[0]!.body!)).toEqual({
      context_uri: 'spotify:album:al1',
    });
  });

  it('without "Steuern" a tap opens the list instead', async () => {
    await connect(['show', 'playlists', 'history', 'library']);
    RECENT = [{ track: TR('r3', 'Drei'), context: { type: 'album', uri: 'spotify:album:al1' } }];
    await renderPage();
    const row = await screen.findByTestId('music-continue');
    fireEvent.click(within(row).getByRole('button', { name: /^Erstes Album/ }));
    await screen.findByRole('button', { name: 'Zurück zur Startansicht' });
    expect(sent('PUT', '/me/player/play')).toHaveLength(0);
  });

  it('no recent context: no row (nothing empty is shown)', async () => {
    await connect();
    RECENT = [{ track: TR('r1', 'Eins') }];
    await renderPage();
    await screen.findByTestId('music-start');
    await waitFor(() => expect(screen.getByTestId('music-start')).toHaveTextContent('Eins'));
    expect(screen.queryByTestId('music-continue')).toBeNull();
  });
});

describe('search', () => {
  it('finds artists and opens their page', async () => {
    await connect();
    route = (c) =>
      c.path.startsWith('/search')
        ? { artists: { items: [{ id: 'ar1', name: 'Erfundene Band', images: [] }] } }
        : undefined;
    await openTab('Suchen');
    fireEvent.change(screen.getByLabelText('Titel, Künstler, Playlist oder Album suchen'), {
      target: { value: 'Band' },
    });
    fireEvent.submit(
      screen.getByLabelText('Titel, Künstler, Playlist oder Album suchen').closest('form')!,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Erfundene Band/ }));
    await screen.findByRole('button', { name: 'Hit abspielen' });
  });
});
