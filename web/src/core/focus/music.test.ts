// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { forgetAccessToken } from '@/core/connectors/context';
import { NO_PREMIUM_KEY } from '@/core/connectors/nowPlaying';
import { saveStatus } from '@/core/connectors/state';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { setNow } from '@/core/time/now';
import {
  DEFAULT_MUSIC,
  isMusicUnreachable,
  MUSIC_KEY,
  onFocusEnd,
  onFocusStart,
  readMusic,
  reloadMusic,
  setMusic,
} from './music';

const secrets = new Map<string, string>([
  ['oauth:spotify:client-id', 'client-invented-123'],
  ['oauth:spotify:refresh', 'RT-invented'],
]);
const calls: string[] = [];
let reply: (call: string) => Response;

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
      const call = `${init?.method ?? 'GET'} ${url.replace('https://api.spotify.com/v1/me/player', '')}${init?.body ? ` ${String(init.body)}` : ''}`;
      calls.push(call);
      return reply(call);
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
let started = 1000;

beforeEach(async () => {
  calls.length = 0;
  reply = () => new Response(null, { status: 204 });
  localStorage.clear();
  reloadMusic();
  forgetAccessToken('spotify');
  install();
  await db.table('_meta').clear();
  started += 1;
});
afterEach(() => {
  setPlatform(undefined);
  setNow();
});

describe('stored choice', () => {
  it('is off by default and survives a reload', () => {
    expect(readMusic()).toEqual(DEFAULT_MUSIC);
    expect(DEFAULT_MUSIC.mode).toBe('off');
    setMusic({ mode: 'playlist', playlistId: 'pl1ABC' });
    reloadMusic();
    expect(readMusic()).toEqual({ mode: 'playlist', playlistId: 'pl1ABC', pauseAtEnd: true });
  });

  it('drops a damaged or foreign value and keeps music off', () => {
    for (const bad of [
      'nope',
      '{"mode":"loud"}',
      '{"mode":"resume"}',
      '{"mode":"playlist","playlistId":"a b","pauseAtEnd":true}',
    ]) {
      localStorage.setItem(MUSIC_KEY, bad);
      expect(readMusic()).toEqual(DEFAULT_MUSIC);
      expect(localStorage.getItem(MUSIC_KEY)).toBeNull();
    }
  });

  it('refuses a playlist id that is not base 62', () => {
    setMusic({ mode: 'playlist', playlistId: 'ok1' });
    setMusic({ playlistId: 'x"y' });
    expect(readMusic().playlistId).toBe('ok1');
  });
});

describe('start of a round', () => {
  it('does nothing while the music is off', async () => {
    await connect();
    await onFocusStart();
    expect(calls).toEqual([]);
  });

  it('"Beim Start weiterspielen" resumes and starts nothing new', async () => {
    await connect();
    setMusic({ mode: 'resume' });
    await onFocusStart();
    expect(calls).toEqual(['PUT /play']);
  });

  it('"Playlist starten" plays the chosen playlist, and nothing without a choice', async () => {
    await connect();
    setMusic({ mode: 'playlist' });
    await onFocusStart();
    expect(calls).toEqual([]);
    setMusic({ playlistId: 'pl1ABC' });
    await onFocusStart();
    expect(calls).toEqual(['PUT /play {"context_uri":"spotify:playlist:pl1ABC"}']);
  });

  it('does not touch Spotify when it is not connected or "Steuern" is missing', async () => {
    setMusic({ mode: 'resume' });
    await onFocusStart();
    await connect(['show']);
    await onFocusStart();
    expect(calls).toEqual([]);
  });

  it('a failing Spotify never throws: the round gets a quiet "unreachable" flag', async () => {
    await connect();
    setMusic({ mode: 'resume' });
    reply = () =>
      new Response(JSON.stringify({ error: { reason: 'NO_ACTIVE_DEVICE' } }), { status: 404 });
    await expect(onFocusStart()).resolves.toBeUndefined();
    expect(isMusicUnreachable()).toBe(true);
    reply = () => new Response(null, { status: 204 });
    await onFocusStart();
    expect(isMusicUnreachable()).toBe(false);
  });

  it('without Premium it remembers that and stops offering the row', async () => {
    await connect();
    setMusic({ mode: 'resume' });
    reply = () =>
      new Response(JSON.stringify({ error: { reason: 'PREMIUM_REQUIRED' } }), { status: 403 });
    await onFocusStart();
    expect(localStorage.getItem(NO_PREMIUM_KEY)).not.toBeNull();
    calls.length = 0;
    await onFocusStart();
    expect(calls).toEqual([]);
  });
});

describe('end of a round', () => {
  it('pauses once per round, whatever ends it (time up, then finish)', async () => {
    await connect();
    setMusic({ mode: 'resume' });
    await onFocusEnd(started);
    await onFocusEnd(started);
    expect(calls).toEqual(['PUT /pause']);
    await onFocusEnd(started + 5000);
    expect(calls).toEqual(['PUT /pause', 'PUT /pause']);
  });

  it('does not pause when the switch is off or the music is off', async () => {
    await connect();
    await onFocusEnd(started);
    setMusic({ mode: 'resume', pauseAtEnd: false });
    await onFocusEnd(started + 1);
    expect(calls).toEqual([]);
  });

  it('never throws when Spotify cannot be reached', async () => {
    await connect();
    setMusic({ mode: 'resume' });
    reply = () => new Response('{}', { status: 503 });
    await expect(onFocusEnd(started)).resolves.toBeUndefined();
  });
});

describe('only start and end', () => {
  it('nothing else in the module reaches the player', async () => {
    const src = (await import('./music?raw')).default as string;
    const uses = [...src.matchAll(/\.(control|startPlaylist)(\?\.)?\(/g)].length;
    expect(uses).toBe(3); // start: play + playlist, end: pause
  });
});
