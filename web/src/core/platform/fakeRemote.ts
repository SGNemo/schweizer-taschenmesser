/**
 * E2E and dev stand-in for the phone's input session (`src-tauri/src/remote_client.rs`): a demo PC
 * "PC-Sven" at volume 42 % that answers like the real hub – its state after every bundle, a
 * refusal with a reason, a close. Only wired up in `--mode e2e` builds (see `web.ts`), and only
 * for pages that set `localStorage['tm-e2e-remote'] = '1'`. Tests steer it through
 * `window.__tmRemote`.
 */
import type {
  RemoteAction,
  RemoteCloseReason,
  RemoteEvent,
  RemoteOpened,
  RemotePcState,
  RemoteService,
} from './types';

const E2E_FLAG = 'tm-e2e-remote';
/** The demo PC's name (the phone knows its PC by the name it shows for sync). */
export const FAKE_PC_NAME = 'PC-Sven';
const STEP = 2;

/** The fake and its test hooks (unit tests use them directly). */
export function createFakeRemoteParts() {
  const pc: RemotePcState = { volume: 42, mute: false, playing: false, locked: false };
  let openError: string | undefined;
  let openErrorsLeft = 0;
  let next = 0;
  let live: { session: number; onEvent: (e: RemoteEvent) => void } | undefined;
  let silent = false;
  const sent: RemoteAction[] = [];
  let opens = 0;

  const apply = (action: RemoteAction) => {
    const volume = pc.volume ?? 0;
    if (action === 'play-pause') pc.playing = !pc.playing;
    else if (action === 'volume-up') {
      pc.volume = Math.min(100, volume + STEP);
      pc.mute = false;
    } else if (action === 'volume-down') pc.volume = Math.max(0, volume - STEP);
    else if (action === 'mute') pc.mute = !pc.mute;
    else if (action === 'lock') pc.locked = true;
  };

  const remote: RemoteService = {
    supported: true,
    open: async (level, onEvent): Promise<RemoteOpened> => {
      opens += 1;
      if (openError && openErrorsLeft > 0) {
        openErrorsLeft -= 1;
        throw new Error(openError);
      }
      next += 1;
      live = { session: next, onEvent };
      return { session: next, level, grant: 'media', unlockRequired: false, state: { ...pc } };
    },
    send: async (session, actions) => {
      if (!live || live.session !== session) throw new Error('closed');
      for (const action of actions) {
        sent.push(action);
        apply(action);
      }
      // the PC answers with its state after what it took in, even unchanged
      if (!silent) live.onEvent({ kind: 'state', session, state: { ...pc } });
    },
    close: async (session) => {
      if (live?.session === session) live = undefined;
    },
  };

  const hooks = {
    /** The next `count` opens fail with this code (`network`, `no-answer`, `paused`, …). */
    failOpen(code: string, count = 1) {
      openError = code;
      openErrorsLeft = count;
    },
    /** The PC ends the session: with its reason, or without one (connection lost). */
    close(reason: RemoteCloseReason | null = null) {
      const session = live;
      live = undefined;
      session?.onEvent({ kind: 'closed', session: session.session, reason });
    },
    /** Something changed at the PC itself (someone turned the volume there). */
    setState(patch: Partial<RemotePcState>) {
      Object.assign(pc, patch);
      if (live) live.onEvent({ kind: 'state', session: live.session, state: { ...pc } });
    },
    /** The PC stops answering without closing (sleep, Wi-Fi gone). */
    goSilent(on = true) {
      silent = on;
    },
    sent: () => [...sent],
    opens: () => opens,
    isOpen: () => live !== undefined,
    state: () => ({ ...pc }),
  };
  return { remote, hooks };
}

export function createFakeRemote(): RemoteService {
  const { remote: inner, hooks } = createFakeRemoteParts();
  const remote: RemoteService = {
    ...inner,
    get supported() {
      try {
        return localStorage.getItem(E2E_FLAG) === '1';
      } catch {
        return false;
      }
    },
  };
  if (typeof window !== 'undefined')
    (window as unknown as { __tmRemote?: unknown }).__tmRemote = hooks;
  return remote;
}
