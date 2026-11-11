import { useSyncExternalStore } from 'react';
import { getPlatform } from '@/core/platform';
import type { RemotePcState } from '@/core/platform/types';
import {
  createRemoteSession,
  type RemotePad,
  type RemoteView,
  type SyncVerdict,
} from '@/core/remote/session';
import { syncNow } from '@/core/sync/service';
import { useSyncStatus } from '@/core/sync/status';
import { now } from '@/core/time/now';

/**
 * Whether this phone is still paired is what a sync round says – never the input session. One
 * round now: not paired with a PC (or the PC unpaired this phone) = `not-paired`; any other
 * failure = `failed`; else `ok`.
 */
export async function syncRound(): Promise<SyncVerdict> {
  // Known to sync another way (a server): no PC is paired. Not known yet (the app has just
  // started and no round has run): only a round can tell.
  const before = useSyncStatus.getState().via;
  if (before !== undefined && before !== 'lanClient') return 'not-paired';
  await syncNow().catch(() => undefined);
  const after = useSyncStatus.getState();
  if (after.via !== 'lanClient') return 'not-paired';
  if (after.phase !== 'error') return 'ok';
  return after.error === 'revoked' ? 'not-paired' : 'failed';
}

/**
 * The one session of the app: the PC keeps one input session per device, so the page and
 * anything else that controls the PC share this instance (a second one would replace the first).
 */
export const remoteSession = createRemoteSession({
  get remote() {
    return getPlatform().remote;
  },
  syncRound,
  now,
});

/**
 * The PC's last known state while the page is in front: an unconnected session keeps showing it
 * quietly instead of an error. Forgotten when the session ends (`idle`). Memory only.
 */
let lastPc: RemotePcState | undefined;
remoteSession.subscribe((view) => {
  if (view.kind === 'connected') lastPc = view.pc;
  else if (view.kind === 'idle') lastPc = undefined;
});

const subscribe = (listener: () => void) => remoteSession.subscribe(() => listener());
const readLast = () => lastPc;

/** The PC's last known state (see above), re-rendering with the session. */
export function useLastPc(): RemotePcState | undefined {
  return useSyncExternalStore(subscribe, readLast, readLast);
}

/** The mouse level of the session (the touchpad reads it), re-rendering on every change. */
export function useRemotePad(): RemotePad {
  return useSyncExternalStore(subscribe, remoteSession.pad, remoteSession.pad);
}

/** The session's state, re-rendering on every change. */
export function useRemoteView(): RemoteView {
  return useSyncExternalStore(subscribe, remoteSession.view, remoteSession.view);
}
