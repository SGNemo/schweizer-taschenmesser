// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetAccessToken } from '@/core/connectors/context';
import { NO_PREMIUM_KEY } from '@/core/connectors/nowPlaying';
import { saveStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { readMusic, reloadMusic } from '@/core/focus/music';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { FocusSection } from './FocusSection';

const secrets = new Map<string, string>([
  ['oauth:spotify:client-id', 'client-invented-123'],
  ['oauth:spotify:refresh', 'RT-invented'],
]);
const requests: string[] = [];
let playlists: () => Response;

function install() {
  const web = createWebPlatform();
  const platform: PlatformService = {
    ...web,
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === 'https://accounts.spotify.com/api/token')
        return new Response(JSON.stringify({ access_token: 'AT-invented', expires_in: 3600 }));
      requests.push(url.replace('https://api.spotify.com/v1', ''));
      return playlists();
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

const LISTS = {
  items: [
    { id: 'pl1ABC', name: 'Tiefer Fokus' },
    { id: 'pl2DEF', name: 'Ruhe' },
  ],
};
const connect = (features = ['show', 'control', 'playlists']) =>
  saveStatus('spotify', { state: 'connected', features });

beforeEach(async () => {
  requests.length = 0;
  playlists = () => new Response(JSON.stringify(LISTS));
  localStorage.clear();
  reloadMusic();
  forgetAccessToken('spotify');
  install();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setPlatform(undefined);
});

const music = () => screen.queryByTestId('focus-group-music');

describe('Musik in der Fokus-Runde (settings row)', () => {
  it('is not there until Spotify is connected with "Steuern"', async () => {
    render(<FocusSection />);
    await new Promise((r) => setTimeout(r, 60));
    expect(music()).toBeNull();
    await connect(['show']);
    await new Promise((r) => setTimeout(r, 60));
    expect(music()).toBeNull();
  });

  it('is hidden again once Premium was ruled out', async () => {
    await connect();
    localStorage.setItem(NO_PREMIUM_KEY, String(Date.now()));
    render(<FocusSection />);
    await new Promise((r) => setTimeout(r, 60));
    expect(music()).toBeNull();
  });

  it('shows one folded line "Musik in der Fokus-Runde: Aus" inside "Weitere Einstellungen"', async () => {
    await connect();
    render(<FocusSection />);
    const row = await screen.findByTestId('focus-group-music');
    expect(row).not.toHaveAttribute('open');
    expect(row.closest('[data-testid="focus-more"]')).toBe(screen.getByTestId('focus-more'));
    expect(within(row).getByText(/Musik in der Fokus-Runde.*Aus/)).toBeInTheDocument();
    expect(readMusic().mode).toBe('off');
    expect(requests).toEqual([]);
  });

  it('"Beim Start weiterspielen" is saved on this device, with the end switch', async () => {
    const user = userEvent.setup();
    await connect();
    render(<FocusSection />);
    const row = await screen.findByTestId('focus-group-music');
    await user.click(row.querySelector('summary')!);
    expect(within(row).queryByRole('switch', { name: 'Am Ende pausieren' })).toBeNull();
    await user.click(within(row).getByRole('button', { name: 'Beim Start weiterspielen' }));
    expect(readMusic().mode).toBe('resume');
    const end = within(row).getByRole('switch', { name: 'Am Ende pausieren' });
    expect(end).toBeChecked();
    await user.click(end);
    expect(readMusic().pauseAtEnd).toBe(false);
    expect(requests).toEqual([]);
  });

  it('loads the playlists only when the row is opened and stores just the chosen id', async () => {
    const user = userEvent.setup();
    await connect();
    render(<FocusSection />);
    const row = await screen.findByTestId('focus-group-music');
    await user.click(row.querySelector('summary')!);
    await user.click(within(row).getByRole('button', { name: 'Playlist starten' }));
    const select = await within(row).findByTestId('focus-music-playlist');
    expect(requests).toEqual(['/me/playlists?limit=50']);
    await user.selectOptions(select, 'pl2DEF');
    expect(readMusic()).toMatchObject({ mode: 'playlist', playlistId: 'pl2DEF' });
    expect(localStorage.getItem('tm-spotify-focus')).not.toContain('Ruhe');
  });

  it('does not ask for playlists while the row is closed', async () => {
    await connect();
    localStorage.setItem(
      'tm-spotify-focus',
      JSON.stringify({ mode: 'playlist', playlistId: 'pl1ABC', pauseAtEnd: true }),
    );
    reloadMusic();
    render(<FocusSection />);
    await screen.findByTestId('focus-group-music');
    await new Promise((r) => setTimeout(r, 80));
    expect(requests).toEqual([]);
  });

  it('asks to connect again when the playlist permission was not given', async () => {
    const user = userEvent.setup();
    await connect(['show', 'control']);
    render(<FocusSection />);
    const row = await screen.findByTestId('focus-group-music');
    await user.click(row.querySelector('summary')!);
    await user.click(within(row).getByRole('button', { name: 'Playlist starten' }));
    expect(await within(row).findByTestId('focus-music-reconnect')).toBeInTheDocument();
    expect(requests).toEqual([]);
  });

  it('says calmly when the playlists cannot be read', async () => {
    const user = userEvent.setup();
    await connect();
    playlists = () => new Response('{}', { status: 503 });
    render(<FocusSection />);
    const row = await screen.findByTestId('focus-group-music');
    await user.click(row.querySelector('summary')!);
    await user.click(within(row).getByRole('button', { name: 'Playlist starten' }));
    await waitFor(() =>
      expect(
        within(row).getByText('Die Playlists sind gerade nicht erreichbar.'),
      ).toBeInTheDocument(),
    );
  });
});
