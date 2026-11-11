import type {
  RemoteAction,
  RemoteButtonAction,
  RemoteCloseReason,
  RemoteEvent,
  RemoteKeyAction,
  RemoteLevel,
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
 * - "connecting" is shown for a few seconds at most, then "no answer yet" (no verdict before the
 *   attempt is over), and a press that waited until then is dropped: it must not arrive much later;
 * - one instance per app serves every screen (the PC keeps one session per device);
 * - the mouse level is asked for only when the touchpad is used (`raise`): Medien stays a media
 *   session. A device granted only media, and a locked PC, get their sentence without a call; a
 *   dismissed unlock is not asked again by itself (only the person's own step asks again);
 * - what the pad sends goes out in order, one write at a time: moves are summed only while a
 *   write is pending, a press that finds the queue full is dropped, a release never is.
 */
export type RemoteView =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  /** Still trying after a few seconds: say so, without a verdict (the attempt goes on). */
  | { kind: 'slow' }
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

/**
 * The mouse level of the session, apart from the session's own state: the touchpad reads this,
 * Medien never does.
 */
export type RemotePad =
  /** Not asked for (yet), or the session is gone. */
  | { kind: 'off' }
  | { kind: 'opening' }
  /** `noLock`: the PC asks for an unlock and this phone has no screen lock (a fact, no block). */
  | { kind: 'ready'; noLock: boolean }
  /** The PC grants this phone media only. */
  | { kind: 'not-granted' }
  /** The PC is locked: no mouse session opens. */
  | { kind: 'locked' }
  /** The phone's unlock was dismissed or failed: waits for the person's own step. */
  | { kind: 'unlock' }
  /** This phone has a screen lock it cannot ask for: the level is not for this phone. */
  | { kind: 'unavailable' };

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
/** "Connecting" is shown at most this long; after that the page says "no answer yet" while it keeps trying. */
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

/**
 * How typing a text ended.
 * - `sent`: handed to the connection, whole (the PC does not confirm a text: "arrived" is more
 *   than this can promise);
 * - `locked`: the PC is locked, nothing was typed;
 * - `busy`: too much is waiting, nothing was typed – the connection is fine, try again;
 * - `failed`: not ready or the connection broke, most likely nothing was typed;
 * - `partial`: a part was typed (the PC was locked or the connection broke in the middle, or
 *   the Enter after the text did not go) – look at the PC before sending again.
 */
export type TypeResult = 'sent' | 'locked' | 'busy' | 'failed' | 'partial';

/** What the pad and the keyboard send: a move or wheel step, mouse buttons, keys, or text. */
type Out =
  | { kind: 'move' | 'scroll'; dx: number; dy: number }
  | { kind: 'buttons'; actions: (RemoteButtonAction | RemoteKeyAction)[] }
  | { kind: 'text'; pieces: string[]; enter: boolean; done(result: TypeResult): void };

/** Longest piece of text handed to the shell at once, in characters (4 bytes each at most). */
const TEXT_PIECE = 400;

/**
 * Text as the shell takes it: control characters become a space (a pasted line break or tab is
 * not a key), cut into pieces at whole characters.
 */
export function textPieces(text: string): string[] {
  // eslint-disable-next-line no-control-regex
  const spaced = text.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]+/g, ' ');
  // half a character (a broken paste) is not text: the shell would refuse the whole call
  const whole = spaced.replace(
    /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
    '\uFFFD',
  );
  const clean = Array.from(whole);
  const pieces: string[] = [];
  for (let i = 0; i < clean.length; i += TEXT_PIECE)
    pieces.push(clean.slice(i, i + TEXT_PIECE).join(''));
  return pieces;
}
/** Entries that may wait behind the write in flight. */
const OUT_MAX = 8;

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
  /** The mouse level right now (a stable object until it changes; listeners hear of changes). */
  pad(): RemotePad;
  /**
   * The touchpad is used: opens the mouse level in place of the media session, if the PC grants
   * it and is not locked. May show the phone's own unlock prompt (`lang` picks its language).
   * `again`: the person's own step – after a dismissed unlock, or coming back to the pad when
   * the PC granted media only (the grant may have been given there meanwhile: one more ask).
   */
  raise(lang?: string, options?: { again?: boolean }): Promise<void>;
  /** One pointer move or wheel step; goes nowhere unless the pad is ready and the PC unlocked. */
  point(kind: 'move' | 'scroll', dx: number, dy: number): void;
  /** Mouse buttons, in order. Presses go nowhere while the PC is locked; a release always goes. */
  click(actions: readonly RemoteButtonAction[]): void;
  /**
   * One key of the fixed list, in order with everything else the level sends. Goes nowhere
   * unless the level is open and the PC unlocked. `true` = it was taken.
   */
  key(action: RemoteKeyAction): boolean;
  /**
   * Types `text` at the PC, then Enter if `enter` (an empty text with `enter` is the key alone).
   * In order with everything else; never dropped silently: the answer says how it ended
   * ([`TypeResult`]). A long text takes its time – the PC takes only so much a second and the
   * shell waits for it. The text lives in the queue until it is written and nowhere after.
   */
  type(text: string, enter: boolean): Promise<TypeResult>;
  /** Whether a press of the phone's volume keys belongs to the PC right now. */
  takesVolumeKeys(): boolean;
}

export function createRemoteSession(deps: RemoteSessionDeps): RemoteSession {
  let view: RemoteView = { kind: 'idle' };
  /** The session actions go to. */
  let session: number | undefined;
  /** A session that did not answer in time: kept for a late answer, replaced on the next touch. */
  let quiet: number | undefined;
  let opening: { generation: number; done: Promise<void>; nudge(): void } | undefined;
  /** The call to the PC that is in flight (also one of an attempt that was left). */
  let dialing: Promise<unknown> | undefined;
  let lastOpenAt = -Infinity;
  let lastAliveAt = -Infinity;
  let answerTimer: ReturnType<typeof setTimeout> | undefined;
  /** The one action that waits for the session to stand, and whose call it belongs to. */
  let waiting: { action: RemoteAction; token: number } | undefined;
  let tokens = 0;
  /** Counts `close()` calls: an attempt that finishes after one must leave nothing behind. */
  let generation = 0;
  const listeners = new Set<(view: RemoteView) => void>();
  /** What the session in `session` may do, and what the PC grants this phone at most. */
  let level: 'media' | 'full' = 'media';
  let grant: RemoteLevel = 'media';
  let noLock = false;
  let pad: RemotePad = { kind: 'off' };
  let raising: { generation: number; run: Promise<void> } | undefined;
  /** What the pad sends, in order; one write at a time. */
  const out: Out[] = [];
  let pumping = false;

  const setPad = (next: RemotePad) => {
    if (
      next.kind === pad.kind &&
      (next.kind !== 'ready' || pad.kind !== 'ready' || next.noLock === pad.noLock)
    )
      return;
    pad = next;
    for (const listener of listeners) listener(view);
  };
  /** Empties the queue; a text that waited is answered, never left hanging. */
  const emptyOut = () => {
    for (const item of out.splice(0)) if (item.kind === 'text') item.done('failed');
  };
  /** The session is gone: the level with it. A dismissed unlock stays, so nothing asks again by itself. */
  const padLost = () => {
    emptyOut();
    level = 'media';
    if (pad.kind !== 'unlock' && pad.kind !== 'unavailable') setPad({ kind: 'off' });
  };

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
    padLost();
    set(event.reason ? { kind: 'refused', reason: event.reason } : { kind: 'disconnected' });
  };

  /** One attempt at the PC; returns the code of what went wrong, or nothing. */
  const tryOpen = async (
    left: () => boolean,
    asked: 'media' | 'full' = 'media',
    lang?: string,
  ): Promise<string | undefined> => {
    const wait = lastOpenAt + OPEN_EVERY_MS - deps.now();
    if (wait > 0) await sleep(wait);
    // strictly one call at a time: one of an attempt that was left settles first, so the PC never
    // sees the old handshake after the new one
    if (dialing) await dialing.catch(() => undefined);
    if (left()) return 'left';
    lastOpenAt = deps.now();
    // The PC may speak before the answer to `open` is here (its reader runs already): what it
    // says is kept until the session's number is known.
    let known: number | undefined;
    const early: RemoteEvent[] = [];
    const onEvent = (event: RemoteEvent) =>
      known === undefined ? early.push(event) : handle(event);
    try {
      const call = deps.remote.open(asked, onEvent, lang);
      dialing = call;
      const opened = await call.finally(() => {
        if (dialing === call) dialing = undefined;
      });
      if (left()) {
        drop(opened.session);
        return 'left';
      }
      drop(quiet);
      quiet = undefined;
      session = opened.session;
      known = opened.session;
      level = opened.level;
      grant = opened.grant;
      noLock = opened.noLock;
      set({ kind: 'connected', pc: opened.state });
      for (const event of early) if (event.session === known) handle(event);
      return undefined;
    } catch (e) {
      return e instanceof Error ? e.message : 'failed';
    }
  };

  const openOnce = async (
    mine: number,
    patience: { start(): void; stop(): void },
  ): Promise<void> => {
    const left = () => mine !== generation;
    stopWaiting();
    patience.start();
    const end = (next?: RemoteView) => {
      patience.stop();
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
    if (opening?.generation === generation) {
      opening.nudge();
      return opening.done;
    }
    const mine = generation;
    // "connecting" is no answer for long: after a few seconds the page says "no answer yet" –
    // not a verdict, the attempt goes on – and a press that waited is dropped (it must not
    // arrive long after the person gave up on it)
    let timer: ReturnType<typeof setTimeout> | undefined;
    const patience = {
      start() {
        patience.stop();
        set({ kind: 'connecting' });
        timer = setTimeout(() => {
          if (mine !== generation || view.kind !== 'connecting') return;
          waiting = undefined;
          set({ kind: 'slow' });
        }, OPEN_PATIENCE_MS);
      },
      stop() {
        if (timer !== undefined) clearTimeout(timer);
        timer = undefined;
      },
    };
    const attempt = {
      generation: mine,
      // "Erneut versuchen" on the slow line joins the running attempt – visibly
      nudge() {
        if (view.kind === 'slow') patience.start();
      },
      done: Promise.resolve(),
    };
    attempt.done = openOnce(mine, patience).finally(() => {
      if (opening === attempt) opening = undefined;
    });
    opening = attempt;
    return attempt.done;
  };

  /**
   * The pad's queue: one write at a time, in order. An error means this session is over. (A
   * media action of `send` is a write of its own beside it; the shell takes one frame at a time.)
   */
  const pump = async () => {
    if (pumping) return;
    pumping = true;
    try {
      for (;;) {
        const item = out.shift();
        if (!item) return;
        const used = session;
        if (used === undefined || level !== 'full') {
          if (item.kind === 'text') item.done('failed');
          emptyOut();
          return;
        }
        try {
          if (item.kind === 'buttons') await deps.remote.send(used, item.actions);
          else if (item.kind === 'text') {
            // whether a piece went out already: what fails after that is "a part was typed"
            let wrote = false;
            // (the page may have left, or the session been replaced, while a piece waited)
            const still = () => {
              if (session !== used || levelNow() !== 'full') throw new Error('closed');
            };
            try {
              for (const piece of item.pieces) {
                still();
                await deps.remote.text(used, piece);
                wrote = true;
              }
              if (item.enter) {
                still();
                await deps.remote.send(used, ['key-enter']);
              }
              item.done('sent');
            } catch (e) {
              const code = e instanceof Error ? e.message : '';
              // `cut`: the shell stopped in the middle of a piece
              item.done(
                wrote || code === 'cut' ? 'partial' : code === 'locked' ? 'locked' : 'failed',
              );
              // the PC is locked, or the shell refused the text: the session is fine
              if (code !== 'locked' && code !== 'bad-text' && code !== 'cut') throw e;
            }
          } else await deps.remote.pointer(used, item.kind, item.dx, item.dy);
        } catch {
          if (session === used) {
            stopWaiting();
            session = undefined;
            drop(used);
            padLost();
            set({ kind: 'disconnected' });
          }
          emptyOut();
          return;
        }
      }
    } finally {
      pumping = false;
    }
  };
  /** Read through a call: an `await` in between may have changed it. */
  const levelNow = (): 'media' | 'full' => level;
  const padUsable = () =>
    session !== undefined && level === 'full' && pad.kind === 'ready' && view.kind === 'connected';

  /** One try at the mouse level; `true` = decided (whatever the outcome), `false` = try once more. */
  const raiseOnce = async (
    lang: string | undefined,
    mine: number,
    last: boolean,
    again: boolean,
  ) => {
    const left = () => mine !== generation;
    if (view.kind !== 'connected') await open();
    if (left() || view.kind !== 'connected') return true;
    // an unlock dismissed while this waited (an older try's prompt was still up) stands
    if (!again && (pad.kind === 'unlock' || pad.kind === 'unavailable')) return true;
    if (level === 'full') {
      setPad({ kind: 'ready', noLock });
      return true;
    }
    // the PC's last word is enough for these two: no call, no prompt
    // (`again`: the PC is asked once more – the grant may have been given there meanwhile)
    if (grant !== 'full' && !again) {
      setPad({ kind: 'not-granted' });
      return true;
    }
    if (view.pc.locked) {
      setPad({ kind: 'locked' });
      return true;
    }
    setPad({ kind: 'opening' });
    const code = await tryOpen(left, 'full', lang);
    // The phone's own answer to the prompt counts even when the page was left meanwhile (the
    // system's prompt may cover the app): coming back must not ask again by itself.
    if (code === 'unlock-cancelled' || code === 'unlock-failed') {
      setPad({ kind: 'unlock' });
      return true;
    }
    if (code === 'unlock-unavailable') {
      setPad({ kind: 'unavailable' });
      return true;
    }
    if (left() || code === 'left') return true;
    if (code === undefined) {
      // the PC opens at the smaller of asked and granted: read what the session really is
      setPad(levelNow() === 'full' ? { kind: 'ready', noLock } : { kind: 'not-granted' });
      return true;
    }
    switch (code) {
      case 'locked':
        setPad({ kind: 'locked' });
        return true;
      case 'unlock-busy':
        setPad({ kind: 'unlock' });
        return true;
      case 'closed':
        setPad({ kind: 'off' });
        return true;
    }
    // Everything else starts from Medien again: the shell knows nothing of the PC any more
    // (`media-first`), both sessions are gone (`unlock-needed`), or the PC took something away –
    // then the media open says what, in the session's own words.
    const old = session;
    session = undefined;
    stopWaiting();
    drop(old);
    setPad(last && code === 'unlock-needed' ? { kind: 'unlock' } : { kind: 'off' });
    await open();
    return last || (code !== 'media-first' && code !== 'unlock-needed');
  };

  return {
    view: () => view,
    pad: () => pad,
    raise(lang, options) {
      // (one from before a `close()` is not this one: it ends by itself and sets nothing)
      if (raising?.generation === generation) return raising.run;
      // a dismissed unlock is asked again only by the person's own step
      if ((pad.kind === 'unlock' || pad.kind === 'unavailable') && !options?.again)
        return Promise.resolve();
      const mine = generation;
      const run = (async () => {
        const again = options?.again === true;
        if (!(await raiseOnce(lang, mine, false, again))) await raiseOnce(lang, mine, true, false);
      })().finally(() => {
        if (raising?.run === run) raising = undefined;
      });
      raising = { generation: mine, run };
      return run;
    },
    point(kind, dx, dy) {
      if (!padUsable() || (view.kind === 'connected' && view.pc.locked)) return;
      if (dx === 0 && dy === 0) return;
      const tail = out[out.length - 1];
      // summed only while a write is pending (the queue is empty otherwise)
      if (tail && tail.kind === kind) {
        tail.dx += dx;
        tail.dy += dy;
      } else if (out.length < OUT_MAX) out.push({ kind, dx, dy });
      void pump();
    },
    click(actions) {
      if (!padUsable()) return;
      const locked = view.kind === 'connected' && view.pc.locked;
      const sendable = actions.filter((a) => !locked || a.endsWith('-up'));
      // a press that finds the queue full is dropped – with its release, which would be spare
      const releasesOnly = sendable.every((a) => a.endsWith('-up'));
      if (sendable.length === 0 || (out.length >= OUT_MAX && !releasesOnly)) return;
      out.push({ kind: 'buttons', actions: sendable });
      void pump();
    },
    key(action) {
      if (!padUsable() || (view.kind === 'connected' && view.pc.locked)) return false;
      if (out.length >= OUT_MAX) return false;
      out.push({ kind: 'buttons', actions: [action] });
      void pump();
      return true;
    },
    type(text, enter) {
      if (!padUsable()) return Promise.resolve('failed');
      if (view.kind === 'connected' && view.pc.locked) return Promise.resolve('locked');
      const pieces = textPieces(text);
      if (pieces.length === 0 && !enter) return Promise.resolve('sent');
      if (out.length >= OUT_MAX) return Promise.resolve('busy');
      return new Promise<TypeResult>((done) => {
        out.push({ kind: 'text', pieces, enter, done });
        void pump();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    open,
    async send(action, options) {
      if (view.kind !== 'connected') {
        const opensByTouch = view.kind === 'idle' || view.kind === 'disconnected';
        // refused, unreachable, …: nothing goes out. A key repeat never opens a connection.
        const joins = (view.kind === 'connecting' || view.kind === 'slow') && opening;
        if (!opensByTouch && !joins) return false;
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
      // every press that goes out is waited for anew
      stopWaiting();
      {
        answerTimer = setTimeout(() => {
          answerTimer = undefined;
          if (session !== used) return;
          // maybe only the answer is late: keep the session for it, show "not connected"
          quiet = used;
          session = undefined;
          padLost();
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
          padLost();
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
      // (a dismissed unlock stays: coming back to the page must not ask again by itself)
      padLost();
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
      ((view.kind === 'disconnected' || view.kind === 'connecting' || view.kind === 'slow') &&
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
