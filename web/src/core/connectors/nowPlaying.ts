/**
 * Device-local helpers of the "Läuft gerade" line: the last reading (`localStorage` `tm-spotify-now`,
 * Zod-checked, never synced, never in reports, never to the AI) and the poller. The poller asks at most
 * every 30 s and only while the app is visible – never in the background.
 */
import { z } from 'zod';
import { now } from '@/core/time/now';
import type { NowPlaying } from './types';

export const NOW_KEY = 'tm-spotify-now';
/** Controls hidden after "PREMIUM_REQUIRED" (epoch ms of the answer); tried again after a day. */
export const NO_PREMIUM_KEY = 'tm-spotify-no-premium';
export const POLL_MS = 30_000;
/** A stored reading older than this is not shown before the first fresh one. */
export const SHOW_STALE_MS = 10 * 60_000;
export const NO_PREMIUM_MS = 24 * 3_600_000;
const MAX_BACKOFF_S = 600;

const nowSchema = z.object({
  at: z.number().finite(),
  value: z.object({
    title: z.string().max(200),
    artist: z.string().max(200),
    playing: z.boolean(),
    trackUrl: z.string().max(300).optional(),
  }),
});
export interface StoredNow {
  at: number;
  value: NowPlaying;
}

function readKey<T>(key: string, parse: (raw: unknown) => T | undefined): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    try {
      const value = parse(JSON.parse(raw));
      if (value !== undefined) return value;
    } catch {
      // Not JSON: treated like any damaged value.
    }
    localStorage.removeItem(key);
  } catch {
    // Storage blocked: nothing remembered.
  }
  return undefined;
}

export function readStoredNow(): StoredNow | undefined {
  return readKey(NOW_KEY, (raw) => {
    const parsed = nowSchema.safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  });
}

export function writeStoredNow(value: NowPlaying | undefined, at: number): void {
  try {
    if (value) localStorage.setItem(NOW_KEY, JSON.stringify({ at, value }));
    else localStorage.removeItem(NOW_KEY);
  } catch {
    // Storage blocked: the line just waits for the next reading.
  }
}

export function noPremiumSince(): number | undefined {
  return readKey(NO_PREMIUM_KEY, (raw) => (typeof raw === 'number' ? raw : undefined));
}

export function setNoPremium(at: number | undefined): void {
  try {
    if (at === undefined) localStorage.removeItem(NO_PREMIUM_KEY);
    else localStorage.setItem(NO_PREMIUM_KEY, JSON.stringify(at));
  } catch {
    // Storage blocked: the controls stay hidden for this session only.
  }
}

/** Disconnecting forgets the last reading and the "no Premium" note. */
export function clearNowPlayingData(): void {
  writeStoredNow(undefined, 0);
  setNoPremium(undefined);
}

export interface Poller {
  /** Reads now (if visible), ignoring the schedule – after the user used a control. */
  refresh(): void;
  stop(): void;
}

/**
 * Calls `poll` right away and then every `POLL_MS`, but only while `document.visibilityState` is
 * "visible": a hidden app has no timer at all and reads once when it comes back. `poll` resolves to
 * `undefined` or the seconds to wait before the next call (`Retry-After`, capped).
 */
export function startPoller(poll: () => Promise<number | undefined>): Poller {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  let stopped = false;
  let nextAllowed = 0;
  const visible = () => document.visibilityState !== 'hidden';

  const clear = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const schedule = (ms: number) => {
    clear();
    if (stopped || !visible()) return;
    timer = setTimeout(() => void run(), ms);
  };
  async function run(force = false): Promise<void> {
    clear();
    if (stopped || running || !visible()) return;
    if (!force && now() < nextAllowed) return schedule(nextAllowed - now());
    running = true;
    let wait: number | undefined;
    try {
      wait = await poll();
    } catch {
      // The poll callback handles its own errors; a failure here just means the next round.
    }
    running = false;
    const ms = wait === undefined ? POLL_MS : Math.min(Math.max(wait, 1), MAX_BACKOFF_S) * 1000;
    nextAllowed = now() + ms;
    schedule(ms);
  }
  const onVisibility = () => {
    if (visible()) void run();
    else clear();
  };
  document.addEventListener('visibilitychange', onVisibility);
  void run();
  return {
    refresh: () => void run(true),
    stop() {
      stopped = true;
      clear();
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
