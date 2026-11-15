import { useEffect, useRef, useSyncExternalStore } from 'react';
import { now } from '@/core/time/now';
import type { NowPlayingHandle } from './useNowPlaying';

/**
 * The sleep timer: pauses Spotify at a set time (15–60 min) or when the song that plays now ends. Device-local
 * (`tm-music-sleep`: the end time only, never a title), off by default, one tap ends it. It runs only while Nemo is
 * open: the page or the widget arms the one timer; an end that passed while Nemo was closed is dropped, never acted on
 * later.
 */
export const SLEEP_KEY = 'tm-music-sleep';
export const SLEEP_MINUTES = [15, 30, 45, 60] as const;
/** An end older than this when Nemo opens again is forgotten instead of pausing late. */
const STALE_MS = 60_000;

export interface SleepTimer {
  /** Epoch ms when the music pauses. */
  at: number;
  /** `track`: set to the end of the song that played then. */
  mode: 'time' | 'track';
}

let state: SleepTimer | undefined = read();
const listeners = new Set<() => void>();

function read(): SleepTimer | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(SLEEP_KEY) ?? 'null') as Partial<SleepTimer> | null;
    if (!raw || typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return undefined;
    return { at: raw.at, mode: raw.mode === 'track' ? 'track' : 'time' };
  } catch {
    return undefined;
  }
}

function write(next: SleepTimer | undefined): void {
  state = next;
  try {
    if (next) localStorage.setItem(SLEEP_KEY, JSON.stringify(next));
    else localStorage.removeItem(SLEEP_KEY);
  } catch {
    // Storage blocked: the timer lasts while the page is open.
  }
  listeners.forEach((l) => l());
}

/** The end time for "in n minutes" or "at the end of this song" (`undefined` when the song's end is not known). */
export function sleepEnd(
  choice: number | 'track',
  reading?: { progressMs?: number; durationMs?: number; readAt: number },
): SleepTimer | undefined {
  if (choice !== 'track') return { at: now() + choice * 60_000, mode: 'time' };
  if (!reading?.durationMs || reading.progressMs === undefined) return undefined;
  const left = Math.max(0, reading.durationMs - reading.progressMs - (now() - reading.readAt));
  return { at: now() + left, mode: 'track' };
}

export function setSleep(next: SleepTimer | undefined): void {
  write(next);
}

/** The timer that is set, if any (a stale one is dropped on the way). */
export function currentSleep(): SleepTimer | undefined {
  if (state && state.at < now() - STALE_MS) write(undefined);
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The timer for the view (re-renders when it is set, ends or is switched off). */
export function useSleep(): SleepTimer | undefined {
  return useSyncExternalStore(subscribe, currentSleep, () => undefined);
}

let armed: { at: number; timer: ReturnType<typeof setTimeout> } | undefined;
let pause: (() => void) | undefined;

/**
 * Arms the one timer while a player is shown (page and widget may both call it: there is only ever one timeout). At
 * the end the music pauses (only while it plays) and the timer is gone.
 */
export function useSleepWatcher(np: NowPlayingHandle | undefined): void {
  const timer = useSleep();
  const latest = useRef(np);
  useEffect(() => {
    latest.current = np;
  });
  useEffect(() => {
    if (!np) return;
    pause = () => {
      const player = latest.current;
      if (player?.canControl && player.current?.playing) void player.control('pause');
    };
  }, [np]);
  useEffect(() => {
    if (!timer || !np) return;
    if (armed?.at === timer.at) return;
    if (armed) clearTimeout(armed.timer);
    const at = timer.at;
    armed = {
      at,
      timer: setTimeout(
        () => {
          armed = undefined;
          if (state?.at !== at) return;
          write(undefined);
          pause?.();
        },
        Math.max(0, at - now()),
      ),
    };
  }, [timer, np]);
  useEffect(() => {
    if (!timer && armed) {
      clearTimeout(armed.timer);
      armed = undefined;
    }
  }, [timer]);
}

/** For tests. */
export function forgetSleep(): void {
  if (armed) clearTimeout(armed.timer);
  armed = undefined;
  pause = undefined;
  state = read();
}
