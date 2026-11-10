import { useEffect } from 'react';
import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { RemoteHostStatus } from '@/core/platform/types';
import { useSyncStatus } from '@/core/sync/status';

/** How often the PC's remote-control state is read while something on screen shows it. */
export const WATCH_MS = 4000;

export interface RemoteHostState {
  /** The last reading; unset before the first one and while the hub is off. */
  status?: RemoteHostStatus;
  /** The hub is not running (remote control lives inside it). */
  off: boolean;
}

/**
 * What this PC's remote control looks like right now (transient, never stored): the top-bar chip,
 * the settings section and "in use" all read it. Device names live only here, in memory.
 */
export const useRemoteHost = create<RemoteHostState>(() => ({ off: true }));

/** Counts the readings asked for, so an answer that arrives after a newer one is dropped. */
let asked = 0;
let applied = 0;

/**
 * Reads the state once and returns it. Answers can overtake each other (the shell serves commands
 * from a thread pool): only the newest one asked for is kept. A reading that fails for any other
 * reason than "the hub is off" no longer vouches for a controller, so the chip goes – the tray,
 * which Rust draws, stays the place that tells who controls.
 */
export async function refreshRemoteHost(): Promise<RemoteHostStatus | undefined> {
  const host = getPlatform().remoteHost;
  if (!host.supported) return undefined;
  const mine = ++asked;
  try {
    const status = await host.status();
    if (mine < applied) return useRemoteHost.getState().status;
    applied = mine;
    useRemoteHost.setState({ status, off: false });
    return status;
  } catch (e) {
    if (mine < applied) return useRemoteHost.getState().status;
    applied = mine;
    if (e instanceof Error && e.message === 'not-started') {
      useRemoteHost.setState({ status: undefined, off: true });
      return undefined;
    }
    const last = useRemoteHost.getState().status;
    if (last?.controller) useRemoteHost.setState({ status: { ...last, controller: null } });
    return undefined;
  }
}

let watchers = 0;
let timer: ReturnType<typeof setInterval> | undefined;

/**
 * Keeps the state fresh while the calling component is mounted. One timer however many
 * components watch. The top-bar chip watches all the time, so it does so only on a PC that is the
 * home-network hub (without the hub there is no remote control and nothing is polled); the
 * settings section passes `whileOpen` and reads for as long as it is on screen.
 */
export function useRemoteHostWatch(whileOpen = false): void {
  const hubOn = useSyncStatus((s) => s.via === 'lanHub');
  const supported = getPlatform().remoteHost.supported;
  const wanted = whileOpen || hubOn;
  useEffect(() => {
    if (!supported || !wanted) return;
    watchers += 1;
    void refreshRemoteHost();
    timer ??= setInterval(() => void refreshRemoteHost(), WATCH_MS);
    return () => {
      watchers -= 1;
      if (watchers > 0) return;
      // nobody reads any more: what is here would only go stale
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      useRemoteHost.setState({ status: undefined, off: true });
    };
  }, [wanted, supported]);
}
