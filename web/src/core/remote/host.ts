import { useEffect } from 'react';
import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { RemoteHostStatus } from '@/core/platform/types';
import { useSyncStatus } from '@/core/sync/status';

/** How often the PC's remote-control state is read while something on screen shows it. */
const WATCH_MS = 4000;

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

/** Reads the state once. Quiet on failure: the next reading catches up. */
export async function refreshRemoteHost(): Promise<void> {
  const host = getPlatform().remoteHost;
  if (!host.supported) return;
  try {
    useRemoteHost.setState({ status: await host.status(), off: false });
  } catch (e) {
    if (e instanceof Error && e.message === 'not-started')
      useRemoteHost.setState({ status: undefined, off: true });
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
    if (!supported) return;
    if (!wanted) {
      useRemoteHost.setState({ status: undefined, off: true });
      return;
    }
    watchers += 1;
    void refreshRemoteHost();
    timer ??= setInterval(() => void refreshRemoteHost(), WATCH_MS);
    return () => {
      watchers -= 1;
      if (watchers === 0 && timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    };
  }, [wanted, supported]);
}
