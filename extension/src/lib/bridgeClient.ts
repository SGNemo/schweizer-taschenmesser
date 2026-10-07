/**
 * Client of the native messaging bridge (runs in the service worker). One port, one session in
 * memory – nothing is stored. Every answer is validated; an unreachable app, a locked vault or an
 * unconfirmed extension are reported as states, never as data.
 */
import {
  PROTOCOL_VERSION,
  replySchema,
  type BridgeErrorCode,
  type BridgeOp,
} from '@nemo/vault-core';

export interface PortLike {
  postMessage(message: unknown): void;
  disconnect(): void;
  onMessage: { addListener(cb: (message: unknown) => void): void };
  onDisconnect: { addListener(cb: () => void): void };
}

export type ConnectionState =
  | { state: 'unlocked' }
  | { state: 'locked' }
  | { state: 'pairing'; pairCode: string }
  | { state: 'rejected' }
  | { state: 'app-missing' };

export type CallError = BridgeErrorCode | 'app-missing' | 'timeout' | 'bad-reply';
export type CallResult = { ok: true; data: unknown } | { ok: false; error: CallError };

export const REQUEST_TIMEOUT_MS = 35_000;

interface Pending {
  resolve(result: CallResult): void;
  timer: ReturnType<typeof setTimeout>;
}

export interface BridgeClientDeps {
  connect(): PortLike;
  /** The extension's own origin; the native host replaces it with the browser-reported one. */
  origin: string;
  randomId?: () => string;
}

export function createBridgeClient(deps: BridgeClientDeps) {
  let port: PortLike | null = null;
  let session: string | null = null;
  let seq = 0;
  const pending = new Map<string, Pending>();
  const newId = deps.randomId ?? (() => crypto.randomUUID());

  const finish = (id: string, result: CallResult) => {
    const entry = pending.get(id);
    if (!entry) return; // unknown or late: ignored
    clearTimeout(entry.timer);
    pending.delete(id);
    entry.resolve(result);
  };

  const drop = () => {
    port = null;
    session = null;
    for (const id of [...pending.keys()]) finish(id, { ok: false, error: 'app-missing' });
  };

  function open(): PortLike {
    if (port) return port;
    const next = deps.connect();
    next.onMessage.addListener((message) => {
      const parsed = replySchema.safeParse(message);
      if (!parsed.success) return; // not ours, not valid: never trusted
      const reply = parsed.data;
      if (reply.ok) finish(reply.id, { ok: true, data: reply.data });
      else
        finish(reply.id, {
          ok: false,
          error: reply.error === 'app-not-running' ? 'app-missing' : reply.error,
        });
    });
    next.onDisconnect.addListener(() => {
      if (port === next) drop();
    });
    port = next;
    return next;
  }

  function send(op: BridgeOp, body: object, withSession: boolean): Promise<CallResult> {
    return new Promise((resolve) => {
      const id = newId();
      let current: PortLike;
      try {
        current = open();
      } catch {
        resolve({ ok: false, error: 'app-missing' });
        return;
      }
      const timer = setTimeout(
        () => finish(id, { ok: false, error: 'timeout' }),
        REQUEST_TIMEOUT_MS,
      );
      pending.set(id, { resolve, timer });
      try {
        current.postMessage({
          v: PROTOCOL_VERSION,
          id,
          op,
          origin: deps.origin,
          body,
          ...(withSession && session ? { session, seq: ++seq } : {}),
        });
      } catch {
        finish(id, { ok: false, error: 'app-missing' });
      }
    });
  }

  /** Says hello (or reuses the session). Never reveals more than the state. */
  async function connectState(): Promise<ConnectionState> {
    if (session) {
      const status = await send('status', {}, false);
      if (status.ok && (status.data as { state?: string }).state === 'unlocked') {
        return { state: 'unlocked' };
      }
      session = null; // locked meanwhile: all data gone with it
    }
    const hello = await send('hello', {}, false);
    if (!hello.ok)
      return hello.error === 'app-missing' ? { state: 'app-missing' } : { state: 'rejected' };
    const data = hello.data as { state?: string; session?: string; pairCode?: string };
    switch (data.state) {
      case 'unlocked':
        if (!data.session) return { state: 'rejected' };
        session = data.session;
        seq = 0;
        return { state: 'unlocked' };
      case 'locked':
        return { state: 'locked' };
      case 'pairing':
        return { state: 'pairing', pairCode: data.pairCode ?? '' };
      default:
        return { state: 'rejected' };
    }
  }

  /** A call that needs a session; says why when it cannot be made. */
  async function call(op: BridgeOp, body: object): Promise<CallResult> {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (!session) {
        const state = await connectState();
        if (state.state === 'app-missing') return { ok: false, error: 'app-missing' };
        if (state.state === 'locked') return { ok: false, error: 'locked' };
        if (state.state !== 'unlocked') return { ok: false, error: 'not-paired' };
      }
      const result = await send(op, body, true);
      if (result.ok) return result;
      if (result.error === 'locked' || result.error === 'no-session') {
        session = null;
        if (result.error === 'locked') return result;
        continue; // the app forgot the session (restart): say hello again once
      }
      return result;
    }
    return { ok: false, error: 'no-session' };
  }

  return {
    connectState,
    call,
    /** Drops the session and the port (locked, tab closed, popup closed). */
    reset() {
      session = null;
      const old = port;
      port = null;
      for (const id of [...pending.keys()]) finish(id, { ok: false, error: 'app-missing' });
      try {
        old?.disconnect();
      } catch {
        // already gone
      }
    },
    hasSession: () => session !== null,
  };
}

export type BridgeClient = ReturnType<typeof createBridgeClient>;
