import type {
  RemoteAction,
  RemoteCloseReason,
  RemoteEvent,
  RemotePcState,
  RemoteService,
} from '@/core/platform/types';

/**
 * The phone's side of one remote-control session: which signal of the PC leads to which state
 * (concept `docs/design/remote-control/CONCEPT.md` §7, signals in the header of
 * `src-tauri/crates/lan-sync/src/transport/input_client.rs`). The phone decides nothing about
 * what it may do – the PC checks every session and every frame; this only reads the answers.
 *
 * Rules kept here:
 * - one `open` at a time, and a new one at most about once a second (the PC counts connection
 *   attempts, sync included) – never one per key repeat;
 * - "the PC's Nemo is too old" only after the PC hung up without a word twice, a few seconds
 *   apart, with a sync round that worked in between; a sync round that fails means "not
 *   reachable", one that says "not paired" means exactly that;
 * - an `unknown-device` never unpairs: only a sync round says whether the device is paired;
 * - a send error is not a state: the session is over, the next touch opens again;
 * - after sending, the PC answers within about half a second; nothing for a few seconds means
 *   "not connected".
 */
export type RemoteView =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'connected'; pc: RemotePcState }
  | { kind: 'not-paired' }
  | { kind: 'unreachable' }
  | { kind: 'refused'; reason: RemoteCloseReason }
  | { kind: 'no-input-here' }
  | { kind: 'too-old' }
  /** The session ended without a reason: the next touch opens again. */
  | { kind: 'disconnected' }
  /** An answer this version does not understand (a newer PC): offer to try again. */
  | { kind: 'retry' };

/** What a sync round says about the pairing. */
export type SyncVerdict = 'ok' | 'not-paired' | 'failed';

export interface RemoteSessionDeps {
  remote: RemoteService;
  /** Runs one sync round now and says how it went (the module wires this to the sync service). */
  syncRound(): Promise<SyncVerdict>;
  /** Epoch ms (tests pass their own clock). */
  now(): number;
}

/** At most one `open` in this time. */
export const OPEN_EVERY_MS = 1000;
/** Between the first and the second try after the PC hung up without a word. */
export const NO_ANSWER_GAP_MS = 4000;
/** No state after something was sent for this long: not connected any more. */
export const ANSWER_WAIT_MS = 3000;

const REASONS: readonly RemoteCloseReason[] = [
  'remote-off',
  'not-granted',
  'busy',
  'paused',
  'locked',
  'unsupported',
  'ended',
  'limit',
];
const isReason = (code: string): code is RemoteCloseReason =>
  (REASONS as readonly string[]).includes(code);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface RemoteSession {
  view(): RemoteView;
  subscribe(listener: (view: RemoteView) => void): () => void;
  /** Opens the session (the page came to the front, or "Erneut versuchen"). */
  open(): Promise<void>;
  /**
   * One action. In the unconnected states a touch opens again first; in refused or unreachable
   * states nothing is sent. `true` when the action went out.
   */
  send(action: RemoteAction): Promise<boolean>;
  /** Ends the session (the page went to the background). */
  close(): Promise<void>;
  /** Whether a press of the phone's volume keys belongs to the PC right now. */
  takesVolumeKeys(): boolean;
}

export function createRemoteSession(deps: RemoteSessionDeps): RemoteSession {
  let view: RemoteView = { kind: 'idle' };
  let session: number | undefined;
  let opening: Promise<void> | undefined;
  let lastOpenAt = -Infinity;
  let answerTimer: ReturnType<typeof setTimeout> | undefined;
  /** Counts `close()` calls: an `open` that finishes after one must not show a session. */
  let generation = 0;
  const listeners = new Set<(view: RemoteView) => void>();

  const set = (next: RemoteView) => {
    view = next;
    for (const listener of listeners) listener(view);
  };
  const stopWaiting = () => {
    if (answerTimer !== undefined) clearTimeout(answerTimer);
    answerTimer = undefined;
  };

  const onEvent = (event: RemoteEvent) => {
    // a late word of a session this page already left
    if (event.session !== session) return;
    if (event.kind === 'state') {
      stopWaiting();
      set({ kind: 'connected', pc: event.state });
      return;
    }
    stopWaiting();
    session = undefined;
    set(event.reason ? { kind: 'refused', reason: event.reason } : { kind: 'disconnected' });
  };

  /** One attempt at the PC; returns the code of what went wrong, or nothing. */
  const tryOpen = async (): Promise<string | undefined> => {
    const wait = lastOpenAt + OPEN_EVERY_MS - deps.now();
    if (wait > 0) await sleep(wait);
    lastOpenAt = deps.now();
    try {
      const opened = await deps.remote.open('media', onEvent);
      session = opened.session;
      set({ kind: 'connected', pc: opened.state });
      return undefined;
    } catch (e) {
      return e instanceof Error ? e.message : 'failed';
    }
  };

  const openOnce = async (): Promise<void> => {
    const mine = generation;
    const left = () => mine !== generation;
    stopWaiting();
    set({ kind: 'connecting' });
    let noAnswers = 0;
    let movedTried = false;
    for (;;) {
      const code = await tryOpen();
      if (left()) {
        // the page went away while this connected: the session is not wanted
        if (code === undefined && session !== undefined) {
          const stale = session;
          session = undefined;
          await deps.remote.close(stale).catch(() => undefined);
        }
        return;
      }
      if (code === undefined) return;
      if (code === 'closed') return; // overtaken by a newer open of this device
      if (code === 'not-paired') return set({ kind: 'not-paired' });
      if (isReason(code)) return set({ kind: 'refused', reason: code });
      if (code === 'protocol') return set({ kind: 'retry' });
      // every other answer needs the one thing only a sync round can tell: paired or not
      const sync = await deps.syncRound();
      if (left()) return;
      if (sync === 'not-paired') return set({ kind: 'not-paired' });
      if (code === 'unknown-device') return set({ kind: 'no-input-here' });
      if (code === 'no-answer') {
        if (sync === 'failed') return set({ kind: 'unreachable' });
        noAnswers += 1;
        if (noAnswers >= 2) return set({ kind: 'too-old' });
        await sleep(NO_ANSWER_GAP_MS);
        if (left()) return;
        continue;
      }
      // `network` (or anything unknown): the PC may have a new address, which a sync round that
      // worked has just found – one more try, then it is "not reachable"
      if (sync === 'ok' && !movedTried) {
        movedTried = true;
        continue;
      }
      return set({ kind: 'unreachable' });
    }
  };

  const open = (): Promise<void> => {
    opening ??= openOnce().finally(() => {
      opening = undefined;
    });
    return opening;
  };

  return {
    view: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open,
    async send(action) {
      if (view.kind === 'idle' || view.kind === 'disconnected') await open();
      else if (view.kind === 'connecting' && opening) await opening;
      if (view.kind !== 'connected' || session === undefined) return false;
      const used = session;
      try {
        await deps.remote.send(used, [action]);
      } catch {
        // never a state of its own: this session is over, the next touch opens again
        if (session === used) {
          stopWaiting();
          session = undefined;
          set({ kind: 'disconnected' });
        }
        return false;
      }
      if (session === used && answerTimer === undefined) {
        answerTimer = setTimeout(() => {
          answerTimer = undefined;
          if (session !== used) return;
          session = undefined;
          void deps.remote.close(used).catch(() => undefined);
          set({ kind: 'disconnected' });
        }, ANSWER_WAIT_MS);
      }
      return true;
    },
    async close() {
      generation += 1;
      stopWaiting();
      const used = session;
      session = undefined;
      set({ kind: 'idle' });
      if (used !== undefined) await deps.remote.close(used).catch(() => undefined);
    },
    takesVolumeKeys: () =>
      view.kind === 'connected' || view.kind === 'disconnected' || view.kind === 'connecting',
  };
}

/** Holding "louder"/"quieter": at most this many steps a second, however fast the keys repeat. */
export const HOLD_STEPS_PER_SECOND = 5;

/** Lets a repeated press through at most [`HOLD_STEPS_PER_SECOND`] times a second. */
export function createHoldGate(now: () => number): () => boolean {
  let last = -Infinity;
  const gap = 1000 / HOLD_STEPS_PER_SECOND;
  return () => {
    const t = now();
    if (t - last < gap) return false;
    last = t;
    return true;
  };
}
