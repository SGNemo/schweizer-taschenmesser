// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NOW_KEY,
  NO_PREMIUM_KEY,
  POLL_MS,
  noPremiumSince,
  readStoredNow,
  setNoPremium,
  startPoller,
  writeStoredNow,
} from './nowPlaying';

let visibility: DocumentVisibilityState = 'visible';
const setVisibility = (v: DocumentVisibilityState) => {
  visibility = v;
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  visibility = 'visible';
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('startPoller', () => {
  it('reads at once and then every 30 seconds while the app is visible', async () => {
    const poll = vi.fn(async () => undefined);
    const p = startPoller(poll);
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(poll).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(poll).toHaveBeenCalledTimes(5);
    p.stop();
    await vi.advanceTimersByTimeAsync(POLL_MS * 3);
    expect(poll).toHaveBeenCalledTimes(5);
  });

  it('never reads in the background: no timer while hidden, one read when it comes back', async () => {
    const poll = vi.fn(async () => undefined);
    const p = startPoller(poll);
    await vi.advanceTimersByTimeAsync(0);
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(POLL_MS * 10);
    expect(poll).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    setVisibility('visible');
    await vi.advanceTimersByTimeAsync(0);
    expect(poll).toHaveBeenCalledTimes(2);
    p.stop();
  });

  it('does not start at all in a hidden app', async () => {
    visibility = 'hidden';
    const poll = vi.fn(async () => undefined);
    const p = startPoller(poll);
    await vi.advanceTimersByTimeAsync(POLL_MS * 4);
    expect(poll).not.toHaveBeenCalled();
    p.stop();
  });

  it('flipping visibility quickly never reads more than once per 30 seconds', async () => {
    const poll = vi.fn(async () => undefined);
    const p = startPoller(poll);
    await vi.advanceTimersByTimeAsync(0);
    for (let i = 0; i < 5; i += 1) {
      setVisibility('hidden');
      setVisibility('visible');
      await vi.advanceTimersByTimeAsync(1000);
    }
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_MS);
    expect(poll).toHaveBeenCalledTimes(2);
    p.stop();
  });

  it('waits as long as the service asks after a rate limit (capped at ten minutes)', async () => {
    const poll = vi.fn<() => Promise<number | undefined>>(async () => 120);
    const p = startPoller(poll);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(119_000);
    expect(poll).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(2);
    poll.mockResolvedValue(99_999);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(poll).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(599_000);
    expect(poll).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(1000);
    expect(poll).toHaveBeenCalledTimes(4);
    p.stop();
  });

  it('refresh() reads now, but not while the app is hidden, and never two at once', async () => {
    let finish: () => void = () => {};
    const poll = vi.fn(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const p = startPoller(poll);
    await vi.advanceTimersByTimeAsync(0);
    p.refresh();
    expect(poll).toHaveBeenCalledTimes(1);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    p.refresh();
    expect(poll).toHaveBeenCalledTimes(2);
    finish();
    await vi.advanceTimersByTimeAsync(0);
    setVisibility('hidden');
    p.refresh();
    expect(poll).toHaveBeenCalledTimes(2);
    p.stop();
  });
});

describe('device-local storage', () => {
  const value = {
    title: 'Testlied',
    artist: 'Band',
    playing: true,
    trackUrl: 'https://open.spotify.com/track/x',
  };

  it('keeps the last reading and forgets it when nothing plays', () => {
    writeStoredNow(value, 1000);
    expect(readStoredNow()).toEqual({ at: 1000, value });
    writeStoredNow(undefined, 2000);
    expect(readStoredNow()).toBeUndefined();
    expect(localStorage.getItem(NOW_KEY)).toBeNull();
  });

  it('drops a damaged or foreign value instead of showing it', () => {
    for (const bad of ['not json', '{"at":"x"}', '{"at":1,"value":{"title":5}}', '[]']) {
      localStorage.setItem(NOW_KEY, bad);
      expect(readStoredNow()).toBeUndefined();
      expect(localStorage.getItem(NOW_KEY)).toBeNull();
    }
  });

  it('remembers "no Premium" and tolerates a damaged flag', () => {
    expect(noPremiumSince()).toBeUndefined();
    setNoPremium(5);
    expect(noPremiumSince()).toBe(5);
    setNoPremium(undefined);
    expect(noPremiumSince()).toBeUndefined();
    localStorage.setItem(NO_PREMIUM_KEY, '"x"');
    expect(noPremiumSince()).toBeUndefined();
  });
});
