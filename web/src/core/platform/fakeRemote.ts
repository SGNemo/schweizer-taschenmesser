/**
 * E2E and dev stand-in for the phone's input session (`src-tauri/src/remote_client.rs`): a demo PC
 * "PC-Sven" at volume 42 % that answers like the real hub – its state after every bundle, a
 * refusal with a reason, a close. Only wired up in `--mode e2e` builds (see `web.ts`), and only
 * for pages that set `localStorage['tm-e2e-remote'] = '1'`. Tests steer it through
 * `window.__tmRemote`.
 */
import type {
  RemoteAction,
  RemoteButtonAction,
  RemoteCloseReason,
  RemoteEvent,
  RemoteOpened,
  RemoteLevel,
  RemotePcState,
  RemoteService,
} from './types';

const E2E_FLAG = 'tm-e2e-remote';
const FAIL_FLAG = 'tm-e2e-remote-fail';
/** The demo PC's name (the phone knows its PC by the name it shows for sync). */
export const FAKE_PC_NAME = 'PC-Sven';
const STEP = 2;

/** The fake and its test hooks (unit tests use them directly). */
export function createFakeRemoteParts() {
  const pc: RemotePcState = { volume: 42, mute: false, playing: false, locked: false };
  let openError: string | undefined;
  let openErrorsLeft = 0;
  let next = 0;
  let live:
    { session: number; level: 'media' | 'full'; onEvent: (e: RemoteEvent) => void } | undefined;
  let silent = false;
  const sent: (RemoteAction | RemoteButtonAction)[] = [];
  const pointed: { kind: 'move' | 'scroll'; dx: number; dy: number }[] = [];
  // what the demo PC grants this phone, and what it said in its last `opened` (like the shell,
  // the fake opens the mouse level only after a media session told the grant)
  let grant: RemoteLevel = 'media';
  let unlockRequired = false;
  let known: { grant: RemoteLevel; unlockRequired: boolean } | undefined;
  let unlock: 'ok' | 'cancel' | 'none' = 'ok';
  let unlocked = false;
  let unlocks = 0;
  const MOUSE = new Set<string>(['left-down', 'left-up', 'right-down', 'right-up']);
  let opens = 0;
  let hold: Promise<void> | undefined;
  let greeting: RemoteCloseReason | undefined;

  const apply = (action: RemoteAction | RemoteButtonAction) => {
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
      let noLock = false;
      if (level === 'full') {
        // the shell's gate: decided before anything is asked or closed
        if (!known) throw new Error('media-first');
        if (known.grant !== 'full') throw new Error('not-granted');
        if (known.unlockRequired && !unlocked) {
          unlocks += 1;
          if (unlock === 'cancel') throw new Error('unlock-cancelled');
          if (unlock === 'none') noLock = true;
          else unlocked = true;
        }
      }
      opens += 1;
      // like the shell: every attempt has a number, also one that fails
      next += 1;
      const session = next;
      if (hold) await hold;
      if (openError && openErrorsLeft > 0) {
        openErrorsLeft -= 1;
        throw new Error(openError);
      }
      // an attempt overtaken by a newer one is not a session
      if (session !== next) throw new Error('closed');
      // a session never gets more than the PC grants, whatever was asked
      const got = level === 'full' && grant === 'full' ? 'full' : 'media';
      live = { session, level: got, onEvent };
      known = { grant, unlockRequired: grant === 'full' && unlockRequired };
      if (greeting) onEvent({ kind: 'closed', session, reason: greeting });
      return {
        session,
        level: got,
        grant,
        unlockRequired: known.unlockRequired,
        noLock,
        state: { ...pc },
      };
    },
    send: async (session, actions) => {
      if (!live || live.session !== session) throw new Error('closed');
      if (live.level !== 'full' && actions.some((a) => MOUSE.has(a))) throw new Error('bad-level');
      for (const action of actions) {
        // like the shell: no button reaches a locked PC
        if (MOUSE.has(action) && pc.locked) continue;
        sent.push(action);
        apply(action);
      }
      // the PC answers with its state after what it took in, even unchanged
      if (!silent) live.onEvent({ kind: 'state', session, state: { ...pc } });
    },
    pointer: async (session, kind, dx, dy) => {
      if (!live || live.session !== session) throw new Error('closed');
      if (live.level !== 'full') throw new Error('bad-level');
      if (pc.locked || (dx === 0 && dy === 0)) return;
      pointed.push({ kind, dx: Math.trunc(dx), dy: Math.trunc(dy) });
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
    /** The next opens wait until the returned function is called (a slow connect). */
    holdOpens(): () => void {
      let release: () => void = () => undefined;
      hold = new Promise<void>((resolve) => (release = resolve));
      return () => {
        hold = undefined;
        release();
      };
    },
    /** The PC ends the next session at once, before the answer to `open` arrives. */
    endRightAfterOpen(reason: RemoteCloseReason | undefined) {
      greeting = reason;
    },
    /** What the PC grants this phone from the next `open` on, and whether it asks for an unlock. */
    setGrant(level: RemoteLevel, askUnlock = false) {
      grant = level;
      unlockRequired = askUnlock;
    },
    /** How the phone's own unlock prompt ends: done, dismissed, or the phone has no lock. */
    setUnlock(answer: 'ok' | 'cancel' | 'none') {
      unlock = answer;
    },
    /** How often the phone asked for an unlock. */
    unlocks: () => unlocks,
    pointed: () => [...pointed],
    level: () => live?.level,
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
  // A spec that needs the very first open to fail says so before the app starts
  // (`tm-e2e-remote-fail` = `<code>` or `<code>:<count>`).
  try {
    const [code, count] = (localStorage.getItem(FAIL_FLAG) ?? '').split(':');
    if (code) hooks.failOpen(code, Number(count) || 1);
  } catch {
    // Storage blocked: nothing arranged.
  }
  return remote;
}
