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
 * - after sending, the PC answers within about half a second; nothing for a few seconds is shown
 *   as "not connected" – the session is kept for a late answer and replaced on the next touch;
 * - while it connects, at most one action waits (the last one): held keys never pile up;
 * - "connecting" is shown for a few seconds at most, then "not reachable" while it keeps trying;
 * - one instance per app serves every screen (the PC keeps one session per device).
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
/** No state after something was sent for this long: shown as not connected (a late answer heals it). */
export const ANSWER_WAIT_MS = 3000;
/** "Connecting" is shown at most this long; after that the page says "not reachable" while it keeps trying. */
export const OPEN_PATIENCE_MS = 5000;
/** The phone's volume keys stay with the PC this long after the session was last alive. */
export const KEYS_LINGER_MS = 5000;

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
   * One action. Without a session a touch opens one first and the action goes out once it stands
   * – only the last such action is kept. A key repeat (`repeat`) never opens a connection. In
   * refused or unreachable states nothing is sent. `true` when the action went out.
   */
  send(action: RemoteAction, options?: { repeat?: boolean }): Promise<boolean>;
  /** Ends the session (the page went to the background). */
  close(): Promise<void>;
  /** Whether a press of the phone's volume keys belongs to the PC right now. */
  takesVolumeKeys(): boolean;
}

export function createRemoteSession(deps: RemoteSessionDeps): RemoteSession {
  let view: RemoteView = { kind: 'idle' };
  /** The session actions go to. */
  let session: number | undefined;
  /** A session that did not answer in time: kept for a late answer, replaced on the next touch. */
  let quiet: number | undefined;
  let opening: { generation: number; done: Promise<void> } | undefined;
  let lastOpenAt = -Infinity;
  let lastAliveAt = -Infinity;
  let answerTimer: ReturnType<typeof setTimeout> | undefined;
  /** The one action that waits for the session to stand, and whose call it belongs to. */
  let waiting: { action: RemoteAction; token: number } | undefined;
  let tokens = 0;
  /** Counts `close()` calls: an attempt that finishes after one must leave nothing behind. */
  let generation = 0;
  const listeners = new Set<(view: RemoteView) => void>();

  const set = (next: RemoteView) => {
    if (view.kind === 'connected' || next.kind === 'connected') lastAliveAt = deps.now();
    view = next;
    for (const listener of listeners) listener(view);
  };
  const stopWaiting = () => {
    if (answerTimer !== undefined) clearTimeout(answerTimer);
    answerTimer = undefined;
  };
  const drop = (id: number | undefined) => {
    if (id !== undefined) void deps.remote.close(id).catch(() => undefined);
  };

  /** What the PC says about session `id` (only ever called for the current or the quiet one). */
  const handle = (event: RemoteEvent) => {
    if (event.session !== session && event.session !== quiet) return;
    stopWaiting();
    if (event.kind === 'state') {
      // a late answer of a session that had gone quiet: it is alive after all
      if (event.session === quiet) {
        session = quiet;
        quiet = undefined;
      }
      set({ kind: 'connected', pc: event.state });
      return;
    }
    if (event.session === quiet) {
      quiet = undefined;
      return;
    }
    session = undefined;
    set(event.reason ? { kind: 'refused', reason: event.reason } : { kind: 'disconnected' });
  };

  /** One attempt at the PC; returns the code of what went wrong, or nothing. */
  const tryOpen = async (left: () => boolean): Promise<string | undefined> => {
    const wait = lastOpenAt + OPEN_EVERY_MS - deps.now();
    if (wait > 0) await sleep(wait);
    if (left()) return 'left';
    lastOpenAt = deps.now();
    // The PC may speak before the answer to `open` is here (its reader runs already): what it
    // says is kept until the session's number is known.
    let known: number | undefined;
    const early: RemoteEvent[] = [];
    const onEvent = (event: RemoteEvent) =>
      known === undefined ? early.push(event) : handle(event);
    try {
      const opened = await deps.remote.open('media', onEvent);
      if (left()) {
        drop(opened.session);
        return 'left';
      }
      drop(quiet);
      quiet = undefined;
      session = opened.session;
      known = opened.session;
      set({ kind: 'connected', pc: opened.state });
      for (const event of early) if (event.session === known) handle(event);
      return undefined;
    } catch (e) {
      return e instanceof Error ? e.message : 'failed';
    }
  };

  const openOnce = async (mine: number): Promise<void> => {
    const left = () => mine !== generation;
    stopWaiting();
    set({ kind: 'connecting' });
    // "connecting" is no answer for long: after a few seconds the page says so, and this goes on
    const patience = setTimeout(() => {
      if (!left() && view.kind === 'connecting') set({ kind: 'unreachable' });
    }, OPEN_PATIENCE_MS);
    const end = (next?: RemoteView) => {
      clearTimeout(patience);
      if (next && !left()) set(next);
    };
    let noAnswers = 0;
    let movedTried = false;
    for (;;) {
      const code = await tryOpen(left);
      if (left() || code === 'left') return end();
      if (code === undefined) return end();
      // overtaken by a newer open of this device: the next touch opens again
      if (code === 'closed') return end({ kind: 'disconnected' });
      if (code === 'not-paired') return end({ kind: 'not-paired' });
      if (isReason(code)) return end({ kind: 'refused', reason: code });
      if (code === 'protocol') return end({ kind: 'retry' });
      // every other answer needs the one thing only a sync round can tell: paired or not
      const sync = await deps.syncRound();
      if (left()) return end();
      if (sync === 'not-paired') return end({ kind: 'not-paired' });
      if (code === 'unknown-device') return end({ kind: 'no-input-here' });
      if (code === 'no-answer') {
        if (sync === 'failed') return end({ kind: 'unreachable' });
        noAnswers += 1;
        if (noAnswers >= 2) return end({ kind: 'too-old' });
        await sleep(NO_ANSWER_GAP_MS);
        if (left()) return end();
        continue;
      }
      // `network` (or anything unknown): the PC may have a new address, which a sync round that
      // worked has just found – one more try, then it is "not reachable"
      if (sync === 'ok' && !movedTried) {
        movedTried = true;
        continue;
      }
      return end({ kind: 'unreachable' });
    }
  };

  const open = (): Promise<void> => {
    // an attempt from before a `close()` is not this one: it ends by itself and leaves nothing
    if (opening?.generation === generation) return opening.done;
    const mine = generation;
    const attempt = {
      generation: mine,
      done: openOnce(mine).finally(() => {
        if (opening === attempt) opening = undefined;
      }),
    };
    opening = attempt;
    return attempt.done;
  };

  return {
    view: () => view,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open,
    async send(action, options) {
      if (view.kind !== 'connected') {
        const opensByTouch = view.kind === 'idle' || view.kind === 'disconnected';
        // refused, unreachable, …: nothing goes out. A key repeat never opens a connection.
        if (!opensByTouch && !(view.kind === 'connecting' && opening)) return false;
        if (opensByTouch && options?.repeat) return false;
        // only the last action waits: what was pressed before it is dropped, not queued
        const mine = { action, token: ++tokens };
        waiting = mine;
        await open();
        if (waiting !== mine) return false;
        waiting = undefined;
      }
      if (view.kind !== 'connected' || session === undefined) return false;
      const used = session;
      // wait for the PC's answer from before the call: it may arrive while the call returns
      if (answerTimer === undefined) {
        answerTimer = setTimeout(() => {
          answerTimer = undefined;
          if (session !== used) return;
          // maybe only the answer is late: keep the session for it, show "not connected"
          quiet = used;
          session = undefined;
          set({ kind: 'disconnected' });
        }, ANSWER_WAIT_MS);
      }
      try {
        await deps.remote.send(used, [action]);
        return true;
      } catch {
        // never a state of its own: this session is over, the next touch opens again
        if (session === used) {
          stopWaiting();
          session = undefined;
          drop(used);
          set({ kind: 'disconnected' });
        }
        return false;
      }
    },
    async close() {
      generation += 1;
      opening = undefined;
      waiting = undefined;
      stopWaiting();
      const used = [session, quiet];
      session = undefined;
      quiet = undefined;
      lastAliveAt = -Infinity;
      set({ kind: 'idle' });
      await Promise.all(
        used.map((id) =>
          id === undefined ? undefined : deps.remote.close(id).catch(() => undefined),
        ),
      );
      lastAliveAt = -Infinity;
    },
    // With a session, and for a few seconds after it was last alive (a drop, a reconnect): then
    // the keys go back to the phone, so its own volume is never out of reach for long.
    takesVolumeKeys: () =>
      view.kind === 'connected' ||
      ((view.kind === 'disconnected' || view.kind === 'connecting') &&
        deps.now() - lastAliveAt < KEYS_LINGER_MS),
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
