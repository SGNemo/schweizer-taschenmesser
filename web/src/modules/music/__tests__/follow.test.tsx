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
let artistFollowed = false;
let FOLLOWED: unknown[] = [];
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
      if (call.path.startsWith('/me/following/contains')) return json([artistFollowed]);
      if (call.path.startsWith('/me/following') && call.method === 'GET')
        return json({ artists: { items: FOLLOWED, next: null } });
      if (call.path === '/playlists/PLb/followers/contains') return json([true]);
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

const ALL = ['show', 'control', 'playlists', 'playlistEdit', 'library', 'history', 'follow'];
const connect = (features = ALL) => saveStatus('spotify', { state: 'connected', features });
const sent = (method: string, prefix: string) =>
  calls.filter((c) => c.method === method && c.path.startsWith(prefix));
const tab = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Ansichten' })).getByRole('button', { name });

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
  artistFollowed = false;
  FOLLOWED = [];
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

describe('following', () => {
  it('an artist page offers "Folgen"; a tap follows, and the albums tab lists the followed artists', async () => {
    await connect();
    FOLLOWED = [{ id: 'ar1', name: 'Erfundene Band', images: [] }];
    await openTab('Alben');
    const grid = await screen.findByTestId('music-followed-artists');
    expect(grid).toHaveTextContent('Erfundene Band');
    fireEvent.click(within(grid).getByRole('button', { name: /Erfundene Band/ }));
    const follow = await screen.findByTestId('music-follow');
    expect(follow).toHaveAttribute('aria-pressed', 'false');
    expect(follow).toHaveAccessibleName('Erfundene Band folgen');
    fireEvent.click(follow);
    await waitFor(() => expect(sent('PUT', '/me/following?type=artist&ids=ar1')).toHaveLength(1));
    expect(screen.getByTestId('music-follow')).toHaveAttribute('aria-pressed', 'true');
    // Back in the tab, the followed artists are read again (after Spotify had the change), not taken from the cache.
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu den Alben' }));
    await screen.findByTestId('music-followed-artists');
    await waitFor(() => expect(sent('GET', '/me/following?').length).toBe(2));
  });

  it('a refused unfollow takes the state back with one sentence', async () => {
    await connect();
    artistFollowed = true;
    route = (c) => (c.method === 'DELETE' ? json({ error: {} }, 500) : undefined);
    await openTab('Alben');
    fireEvent.click(await screen.findByRole('button', { name: /^Erstes Album/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Künstler: Erfundene Band' }));
    const follow = await screen.findByTestId('music-follow');
    expect(follow).toHaveTextContent('Gefolgt');
    fireEvent.click(follow);
    await waitFor(() =>
      expect(useUiStore.getState().toasts[0]?.message).toBe('Entfolgen hat nicht geklappt.'),
    );
    expect(screen.getByTestId('music-follow')).toHaveAttribute('aria-pressed', 'true');
  });

  it('without "Folgen": no button, no list, nothing asked', async () => {
    await connect(['show', 'control', 'playlists', 'library']);
    await openTab('Alben');
    fireEvent.click(await screen.findByRole('button', { name: /^Erstes Album/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Künstler: Erfundene Band' }));
    await screen.findByRole('button', { name: 'Hit abspielen' });
    expect(screen.queryByTestId('music-follow')).toBeNull();
    expect(sent('GET', '/me/following')).toHaveLength(0);
  });

  it("someone else's playlist can be unfollowed; an own playlist has no follow button", async () => {
    await connect();
    await openTab('Playlists');
    fireEvent.click(await screen.findByRole('button', { name: /^Autofahrt/ }));
    const follow = await screen.findByTestId('music-follow');
    expect(follow).toHaveTextContent('Gefolgt');
    fireEvent.click(follow);
    await waitFor(() => expect(sent('DELETE', '/playlists/PLb/followers')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu den Playlists' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    expect(screen.queryByTestId('music-follow')).toBeNull();
  });
});
