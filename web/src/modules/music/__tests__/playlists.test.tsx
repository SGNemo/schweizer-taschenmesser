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
import { VIEW_KEY } from '../playlistFilter';
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
const sent = (method: string, prefix: string) =>
  calls.filter((c) => c.method === method && c.path.startsWith(prefix));
const main = () => screen.getByTestId('music-main');
const tab = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Ansichten' })).getByRole('button', { name });
const tiles = () =>
  within(screen.getByTestId('music-lib-grid'))
    .getAllByTestId('music-tile-title')
    .map((el) => el.textContent);

async function openTab() {
  render(
    <MemoryRouter initialEntries={['/music']}>
      <AreaFrame>
        <MusicPage />
      </AreaFrame>
    </MemoryRouter>,
  );
  await screen.findByTestId('module-frame');
  fireEvent.click(await screen.findByRole('button', { name: 'Playlists' }));
  await waitFor(() => expect(tab('Playlists')).toHaveAttribute('aria-current'));
}

beforeEach(async () => {
  calls.length = 0;
  route = () => undefined;
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

describe('playlists tab', () => {
  it('shows every playlist as a tile, own and followed, with owner, "Gemeinsam" and song count', async () => {
    await connect();
    await openTab();
    await waitFor(() => expect(main()).toHaveTextContent('4 Playlists'));
    expect(tab('Playlists')).toHaveAttribute('aria-current');
    const grid = screen.getByTestId('music-lib-grid');
    expect(grid).toHaveTextContent('Fokus');
    expect(grid).toHaveTextContent('40 Titel · von Kim');
    expect(grid).toHaveTextContent('7 Titel · von Kim · Gemeinsam');
    // Own playlists name no owner.
    expect(grid).not.toHaveTextContent('von Ich');
    // The start view and the tab share one read of every page (`all`); the account id is asked once.
    expect(sent('GET', '/me/playlists')).toHaveLength(1);
    expect(sent('GET', '/me').filter((c) => c.path === '/me')).toHaveLength(1);
  });

  it('the tab takes the playlists of the start view without reading them again', async () => {
    await connect();
    render(
      <MemoryRouter initialEntries={['/music']}>
        <AreaFrame>
          <MusicPage />
        </AreaFrame>
      </MemoryRouter>,
    );
    await screen.findByTestId('music-playlists');
    fireEvent.click(tab('Playlists'));
    await waitFor(() => expect(tiles()).toHaveLength(4));
    expect(sent('GET', '/me/playlists')).toHaveLength(1);
  });

  it('search runs over name and description, ignoring case and accents; no match offers a reset', async () => {
    await connect();
    await openTab();
    const search = await screen.findByRole('searchbox', { name: 'Playlists durchsuchen' });
    fireEvent.change(search, { target: { value: 'ohne worte' } });
    expect(tiles()).toEqual(['Fokus']);
    // The heading stays; the count is a status line, so a screen reader hears the change.
    expect(screen.getByRole('heading', { name: 'Playlists' })).toBeInTheDocument();
    expect(screen.getByTestId('music-lib-count')).toHaveTextContent('1 von 4 Playlists');
    expect(screen.getByTestId('music-lib-count')).toHaveAttribute('role', 'status');
    fireEvent.change(search, { target: { value: 'ABENDESSEN' } });
    expect(tiles()).toEqual(['Abendessen']);
    fireEvent.change(search, { target: { value: 'gibt es nicht' } });
    expect(main()).toHaveTextContent('Keine Playlist passt dazu.');
    fireEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(tiles()).toHaveLength(4);
  });

  it('filters own and followed, sorts, and keeps only the two choices on this device', async () => {
    await connect();
    await openTab();
    const filter = await screen.findByRole('group', { name: 'Welche Playlists' });
    fireEvent.click(within(filter).getByRole('button', { name: 'Eigene' }));
    expect(tiles()).toEqual(['Fokus', 'Abendessen']);
    fireEvent.click(within(filter).getByRole('button', { name: 'Gefolgte' }));
    expect(tiles()).toEqual(['Autofahrt', 'Gemeinsame Party']);
    fireEvent.click(within(filter).getByRole('button', { name: 'Alle' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Sortieren' }), {
      target: { value: 'name' },
    });
    expect(tiles()).toEqual(['Abendessen', 'Autofahrt', 'Fokus', 'Gemeinsame Party']);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sortieren' }), {
      target: { value: 'count' },
    });
    expect(tiles()).toEqual(['Autofahrt', 'Fokus', 'Gemeinsame Party', 'Abendessen']);
    expect(localStorage.getItem(VIEW_KEY)).toBe('{"filter":"all","sort":"count"}');
    // A reload starts with the same choice.
    cleanup();
    forgetLibrary();
    await openTab();
    await waitFor(() =>
      expect(tiles()).toEqual(['Autofahrt', 'Fokus', 'Gemeinsame Party', 'Abendessen']),
    );
  });

  it('without a known account the own/followed filter is left out (nothing would count as own)', async () => {
    await connect();
    route = (c) => (c.path === '/me' ? json({ error: {} }, 500) : undefined);
    await openTab();
    await waitFor(() => expect(tiles()).toHaveLength(4));
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Welche Playlists' })).toBeNull(),
    );
  });

  it('without the "Playlists" feature: one sentence where to switch it on, nothing is asked', async () => {
    await connect(['show', 'control']);
    await openTab();
    expect(main()).toHaveTextContent('braucht Nemo die Funktion „Playlists“');
    expect(sent('GET', '/me/playlists')).toHaveLength(0);
  });

  it('a tile opens the playlist with its description and a way back to the tab', async () => {
    await connect();
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    expect(screen.getByTestId('music-list-about')).toHaveTextContent('Ruhig & ohne Worte');
    // Focus moves to the opened list's title.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Fokus' })),
    );
    expect(tab('Playlists')).toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu den Playlists' }));
    await screen.findByTestId('music-lib-grid');
  });
});

describe('making and changing playlists', () => {
  it('"Neue Playlist" creates a private one with a description and opens it', async () => {
    await connect();
    route = (c) =>
      c.method === 'POST' && c.path === '/me/playlists'
        ? json({ id: 'PLa', name: 'Fokus' }, 201)
        : undefined;
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Playlist' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Fokus' },
    });
    fireEvent.change(within(dialog).getByRole('textbox', { name: /Beschreibung/ }), {
      target: { value: 'Zum Lernen' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen' }));
    await waitFor(() => expect(sent('POST', '/me/playlists')).toHaveLength(1));
    expect(JSON.parse(sent('POST', '/me/playlists')[0]!.body!)).toEqual({
      name: 'Fokus',
      public: false,
      description: 'Zum Lernen',
    });
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    expect(useUiStore.getState().toasts[0]?.message).toBe('„Fokus“ angelegt.');
  });

  it('a failed create keeps the dialog open with what was typed', async () => {
    await connect();
    route = (c) =>
      c.method === 'POST' && c.path === '/me/playlists' ? json({ error: {} }, 500) : undefined;
    await openTab();
    fireEvent.click(screen.getByRole('button', { name: 'Neue Playlist' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Wichtig' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Deine Eingabe bleibt');
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Wichtig');
  });

  it('without "Playlists bearbeiten": no button, one sentence where to switch it on', async () => {
    await connect(['show', 'control', 'playlists']);
    await openTab();
    expect(screen.queryByRole('button', { name: 'Neue Playlist' })).toBeNull();
    expect(main()).toHaveTextContent('Playlists bearbeiten');
  });

  it('an own playlist can be renamed and described; the head shows it at once', async () => {
    await connect();
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    fireEvent.click(await screen.findByRole('button', { name: '„Fokus“ bearbeiten' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: /Beschreibung/ })).toHaveValue(
      'Ruhig & ohne Worte',
    );
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Tiefe Arbeit' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' }));
    await waitFor(() => expect(sent('PUT', '/playlists/PLa')).toHaveLength(1));
    // Only what changed is sent.
    expect(JSON.parse(sent('PUT', '/playlists/PLa')[0]!.body!)).toEqual({ name: 'Tiefe Arbeit' });
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Tiefe Arbeit' })).toBeInTheDocument(),
    );
  });

  it('a followed playlist offers neither "Bearbeiten" nor "Entfernen"', async () => {
    await connect();
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Autofahrt/ }));
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    expect(screen.queryByRole('button', { name: /bearbeiten$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Zwei' }));
    await screen.findByRole('menuitem', { name: 'Zur Warteschlange hinzufügen' });
    expect(screen.queryByRole('menuitem', { name: 'Aus dieser Playlist entfernen' })).toBeNull();
  });

  it('removes a song from an own playlist, and "Rückgängig" puts it back at its place', async () => {
    await connect();
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Zwei' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Aus dieser Playlist entfernen' }));
    await waitFor(() => expect(screen.getAllByTestId('track-row')).toHaveLength(2));
    // The menu went with its row: focus is on the next song.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Drei abspielen' })),
    );
    await waitFor(() => expect(sent('DELETE', '/playlists/PLa/items')).toHaveLength(1));
    expect(JSON.parse(sent('DELETE', '/playlists/PLa/items')[0]!.body!)).toEqual({
      items: [{ uri: 'spotify:track:s2' }],
    });
    const toast = useUiStore.getState().toasts[0]!;
    expect(toast.message).toBe('„Zwei“ entfernt.');
    toast.action!.run();
    await waitFor(() => expect(screen.getAllByTestId('track-row')).toHaveLength(3));
    await waitFor(() => expect(sent('POST', '/playlists/PLa/items')).toHaveLength(1));
    expect(JSON.parse(sent('POST', '/playlists/PLa/items')[0]!.body!)).toEqual({
      uris: ['spotify:track:s2'],
      position: 1,
    });
  });

  it('a refused removal keeps the song and says so', async () => {
    await connect();
    route = (c) => (c.method === 'DELETE' ? json({ error: { status: 500 } }, 500) : undefined);
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Zwei' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Aus dieser Playlist entfernen' }));
    await waitFor(() =>
      expect(useUiStore.getState().toasts[0]?.message).toBe(
        'Entfernen hat nicht geklappt. Der Titel bleibt in der Playlist.',
      ),
    );
    expect(screen.getAllByTestId('track-row')).toHaveLength(3);
  });

  it('a shared playlist of someone else: songs can be removed, but name and description stay with the owner', async () => {
    await connect();
    route = (c) =>
      c.method === 'GET' && c.path.startsWith('/playlists/PLd')
        ? { ...CONTENT('other'), name: 'Gemeinsame Party', collaborative: true }
        : undefined;
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Gemeinsame Party/ }));
    await screen.findByRole('button', { name: 'Zwei abspielen' });
    expect(screen.queryByRole('button', { name: /bearbeiten$/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mehr zu Zwei' }));
    expect(
      await screen.findByRole('menuitem', { name: 'Aus dieser Playlist entfernen' }),
    ).toBeInTheDocument();
  });

  it('a song that is in the playlist twice is not offered for removal (Rückgängig could put back one)', async () => {
    await connect();
    route = (c) =>
      c.method === 'GET' && c.path.startsWith('/playlists/PLa')
        ? {
            ...CONTENT(ME),
            tracks: { total: 3, items: [T('s1', 'Eins'), T('s2', 'Zwei'), T('s2', 'Zwei')] },
          }
        : undefined;
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    await screen.findByRole('button', { name: 'Eins abspielen' });
    fireEvent.click(screen.getAllByRole('button', { name: 'Mehr zu Zwei' })[0]!);
    await screen.findByRole('menuitem', { name: 'Zur Warteschlange hinzufügen' });
    expect(screen.queryByRole('menuitem', { name: 'Aus dieser Playlist entfernen' })).toBeNull();
  });

  it('a playlist made with "Zu Playlist hinzufügen" shows in the tab without reopening the page', async () => {
    await connect();
    let made = false;
    route = (c) => {
      if (c.method === 'POST' && c.path === '/me/playlists') {
        made = true;
        return json({ id: 'PLn', name: 'Frisch' }, 201);
      }
      if (c.method === 'GET' && c.path.startsWith('/me/playlists') && made)
        return { items: [...LISTS, PL('PLn', 'Frisch')], next: null };
      return undefined;
    };
    await openTab();
    fireEvent.click(await screen.findByRole('button', { name: /^Fokus/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mehr zu Zwei' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Zu Playlist hinzufügen …' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name der Playlist' }), {
      target: { value: 'Frisch' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen und hinzufügen' }));
    await waitFor(() => expect(sent('POST', '/playlists/PLn/items')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Zurück zu den Playlists' }));
    await waitFor(() => expect(tiles()).toContain('Frisch'));
  });
});
