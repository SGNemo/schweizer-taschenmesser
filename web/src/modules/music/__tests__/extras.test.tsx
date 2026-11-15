// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { SLEEP_KEY, forgetSleep } from '../sleepTimer';
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

const PLAYING = {
  is_playing: true,
  currently_playing_type: 'track',
  progress_ms: 60_000,
  item: {
    name: 'Jetzt & hier',
    artists: [{ name: 'Erfundene Band' }],
    album: { name: 'Album' },
    duration_ms: 200_000,
    external_urls: { spotify: 'https://open.spotify.com/track/cur111' },
  },
};
const opened: string[] = [];

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
    app: { ...web.app, openUrl: async (url: string) => void opened.push(url) },
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
      if (call.path.startsWith('/me/player/currently-playing')) return json(PLAYING);
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

const ALL = ['show', 'control', 'playlists', 'playlistEdit'];
const connect = (features = ALL) => saveStatus('spotify', { state: 'connected', features });
async function renderPage() {
  render(
    <MemoryRouter initialEntries={['/music']}>
      <AreaFrame>
        <MusicPage />
      </AreaFrame>
    </MemoryRouter>,
  );
  await screen.findByTestId('module-frame');
  await screen.findByTestId('music-now');
}
beforeEach(async () => {
  calls.length = 0;
  route = () => undefined;
  opened.length = 0;
  localStorage.clear();
  forgetSleep();
  forgetAccessToken('spotify');
  forgetLibrary();
  install();
  await db.table('_meta').clear();
  await enableModule(manifest);
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  forgetSleep();
  setPlatform(undefined);
  clearCovers();
  forgetRecent();
});

describe('sleep timer', () => {
  it('pauses in n minutes: the line says when, keeps only the time on this device, one tap ends it', async () => {
    await connect();
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Schlaf-Timer' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'In 30 Min. pausieren' }));
    const line = await screen.findByTestId('music-sleep');
    expect(line).toHaveTextContent(/Pausiert um \d{1,2}[:.]\d{2}/);
    expect(line).toHaveTextContent('Nur solange Nemo offen ist.');
    const stored = JSON.parse(localStorage.getItem(SLEEP_KEY)!);
    expect(Object.keys(stored).sort()).toEqual(['at', 'mode']);
    expect(stored.mode).toBe('time');
    fireEvent.click(screen.getByRole('button', { name: 'Schlaf-Timer aus' }));
    await waitFor(() => expect(screen.queryByTestId('music-sleep')).toBeNull());
    expect(localStorage.getItem(SLEEP_KEY)).toBeNull();
  });

  it('"Am Ende dieses Titels" sets the end from the song that plays', async () => {
    await connect();
    await renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Schlaf-Timer' }));
    fireEvent.click(
      await screen.findByRole('menuitem', { name: 'Am Ende dieses Titels pausieren' }),
    );
    expect(await screen.findByTestId('music-sleep')).toHaveTextContent(
      'Pausiert am Ende des Titels',
    );
    expect(JSON.parse(localStorage.getItem(SLEEP_KEY)!).mode).toBe('track');
  });

  it('without "Steuern" there is no sleep timer', async () => {
    await connect(['show']);
    await renderPage();
    expect(screen.queryByRole('button', { name: 'Schlaf-Timer' })).toBeNull();
  });
});

describe('lyrics', () => {
  it('opens a search for artist and title on genius.com, on tap only', async () => {
    await connect();
    await renderPage();
    expect(opened).toEqual([]);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Liedtext zu „Jetzt & hier“ auf genius.com suchen',
      }),
    );
    await waitFor(() =>
      expect(opened).toEqual(['https://genius.com/search?q=Erfundene%20Band%20Jetzt%20%26%20hier']),
    );
    // Nothing went to genius.com through the app itself.
    expect(calls.some((c) => c.path.includes('genius'))).toBe(false);
  });
});
