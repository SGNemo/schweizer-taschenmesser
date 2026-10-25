// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetAccessToken } from '@/core/connectors/context';
import { NOW_KEY, NO_PREMIUM_KEY } from '@/core/connectors/nowPlaying';
import { loadStatus, saveStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { useUiStore } from '@/stores/ui';
import { NowPlayingLine } from './NowPlayingLine';

const TRACK = {
  is_playing: true,
  currently_playing_type: 'track',
  item: {
    name: 'Testlied',
    artists: [{ name: 'Erfundene Band' }],
    external_urls: { spotify: 'https://open.spotify.com/track/abc123' },
  },
};

const secrets = new Map<string, string>([
  ['oauth:spotify:client-id', 'client-invented-123'],
  ['oauth:spotify:refresh', 'RT-invented'],
]);
type Reply = () => Response;
let player: Reply;
let command: (name: string) => Response;
const requests: string[] = [];

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
      requests.push(
        `${init?.method ?? 'GET'} ${url.replace('https://api.spotify.com/v1/me/player', '')}`,
      );
      if (url.includes('/currently-playing')) return player();
      return command(url.split('/').pop()!);
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

const connect = (features = ['show', 'control']) =>
  saveStatus('spotify', { state: 'connected', features });
const body =
  (status: number, json: unknown = {}) =>
  () =>
    new Response(JSON.stringify(json), { status });

beforeEach(async () => {
  requests.length = 0;
  player = body(200, TRACK);
  command = () => new Response(null, { status: 204 });
  localStorage.clear();
  forgetAccessToken('spotify');
  install();
  await db.table('_meta').clear();
  useUiStore.setState({ toasts: [] });
});
afterEach(() => {
  cleanup();
  setPlatform(undefined);
});

describe('NowPlayingLine', () => {
  it('shows nothing and asks nothing while Spotify is not connected', async () => {
    render(<NowPlayingLine />);
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByTestId('now-playing-line')).toBeNull();
    expect(requests).toEqual([]);
  });

  it('shows "Läuft gerade: Titel – Interpret" with the title as a safe link', async () => {
    await connect();
    render(<NowPlayingLine />);
    const line = await screen.findByTestId('now-playing-line');
    expect(line).toHaveTextContent('Läuft gerade: Testlied – Erfundene Band');
    const link = screen.getByRole('link', { name: 'Testlied' });
    expect(link).toHaveAttribute('href', 'https://open.spotify.com/track/abc123');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    expect(link).toHaveAttribute('target', '_blank');
    // The last reading is kept on this device only.
    expect(JSON.parse(localStorage.getItem(NOW_KEY)!).value.title).toBe('Testlied');
  });

  it('is gone when nothing plays (204) and forgets the stored reading', async () => {
    await connect();
    player = () => new Response(null, { status: 204 });
    localStorage.setItem(
      NOW_KEY,
      JSON.stringify({ at: Date.now(), value: { title: 'Alt', artist: 'x', playing: true } }),
    );
    render(<NowPlayingLine />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryByTestId('now-playing-line')).toBeNull());
    expect(localStorage.getItem(NOW_KEY)).toBeNull();
  });

  it('shows nothing without "Anzeigen", even if the control scope is there', async () => {
    await connect(['control']);
    render(<NowPlayingLine />);
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByTestId('now-playing-line')).toBeNull();
    expect(requests).toEqual([]);
  });

  it('pauses and resumes, and asks for the next track', async () => {
    await connect();
    render(<NowPlayingLine />);
    const toggle = await screen.findByTestId('now-playing-toggle');
    expect(toggle).toHaveTextContent('Pause');
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(screen.getByTestId('now-playing-toggle')).toHaveTextContent('Weiter'),
    );
    expect(screen.getByTestId('now-playing-line')).toHaveTextContent('Pausiert: Testlied');
    fireEvent.click(screen.getByTestId('now-playing-toggle'));
    await waitFor(() =>
      expect(screen.getByTestId('now-playing-toggle')).toHaveTextContent('Pause'),
    );
    fireEvent.click(screen.getByTestId('now-playing-next'));
    await waitFor(() => expect(requests).toContain('POST /next'));
    expect(requests).toContain('PUT /pause');
    expect(requests).toContain('PUT /play');
  });

  it('shows no controls without the "Steuern" feature', async () => {
    await connect(['show']);
    render(<NowPlayingLine />);
    await screen.findByTestId('now-playing-line');
    expect(screen.queryByTestId('now-playing-toggle')).toBeNull();
    expect(screen.queryByTestId('now-playing-next')).toBeNull();
  });

  it('without Premium: hides the controls, says so once and keeps the display', async () => {
    await connect();
    command = () =>
      new Response(JSON.stringify({ error: { status: 403, reason: 'PREMIUM_REQUIRED' } }), {
        status: 403,
      });
    render(<NowPlayingLine />);
    fireEvent.click(await screen.findByTestId('now-playing-toggle'));
    await waitFor(() => expect(screen.queryByTestId('now-playing-toggle')).toBeNull());
    expect(screen.queryByTestId('now-playing-next')).toBeNull();
    expect(screen.getByTestId('now-playing-line')).toHaveTextContent('Testlied');
    expect(useUiStore.getState().toasts.map((x) => x.message)).toEqual([
      'Steuern braucht Spotify Premium.',
    ]);
    expect(localStorage.getItem(NO_PREMIUM_KEY)).not.toBeNull();
    // A later start does not offer them again (and does not repeat the hint).
    cleanup();
    useUiStore.setState({ toasts: [] });
    render(<NowPlayingLine />);
    await screen.findByTestId('now-playing-line');
    expect(screen.queryByTestId('now-playing-toggle')).toBeNull();
    expect(useUiStore.getState().toasts).toEqual([]);
  });

  it('marks the connection expired when Spotify rejects the sign-in, and the line goes away', async () => {
    await connect();
    player = body(401);
    render(<NowPlayingLine />);
    await waitFor(async () => expect((await loadStatus('spotify')).state).toBe('expired'));
    await waitFor(() => expect(screen.queryByTestId('now-playing-line')).toBeNull());
  });

  it('keeps the last reading and says nothing when Spotify cannot be reached', async () => {
    await connect();
    player = body(503);
    localStorage.setItem(
      NOW_KEY,
      JSON.stringify({
        at: Date.now(),
        value: { title: 'Zuletzt', artist: 'Band', playing: true },
      }),
    );
    render(<NowPlayingLine />);
    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(screen.getByTestId('now-playing-line')).toHaveTextContent('Zuletzt');
    expect(screen.queryByRole('alert')).toBeNull();
    expect((await loadStatus('spotify')).state).toBe('connected');
  });
});
