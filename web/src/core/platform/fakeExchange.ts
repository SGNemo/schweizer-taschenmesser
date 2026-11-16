import type {
  ExchangeAnswer,
  ExchangeAnswerState,
  ExchangeDevice,
  ExchangeEvent,
  ExchangeItem,
  ExchangeKind,
  ExchangeService,
} from './types';

/** The demo phone of the fake PC and the demo PC of the fake phone (same id both ways). */
export const FAKE_PEER = 'ab'.repeat(32);

/** Hooks for e2e tests (E2E builds only), on `globalThis.__exchangeFake`. */
export interface FakeExchangeHooks {
  /** Something arrives from the other device. */
  arrive(kind: ExchangeKind, body: string): void;
  /** PC: the phone is (not) connected; queued items go out while it is and the grant allows. */
  setConnected(on: boolean): void;
  /** Answers an item that waits (PC: from the queue; phone: a sent one). */
  answer(id: string, state: ExchangeAnswerState): void;
  /** Phone: the next `open` fails with this code (`exchange-off`, `limit:12`, `network` …). */
  refuseOpen(code: string | null): void;
  /** Phone: the PC ends the open session. */
  closeSession(reason: string | null, minutes?: number | null): void;
}

const hex = (n: number): string => n.toString(16).padStart(32, '0');

/** The same checks as the shell's `Item::new` (enough of them for the page's tests). */
function valid(kind: ExchangeKind, body: string): boolean {
  if (!body.trim() || body.length > 16_384) return false;
  if (kind === 'link') return /^https?:\/\/[^\s/@\\?#][^\s@\\]*$/i.test(body);
  return true;
}

/**
 * E2E builds only: device exchange without a network, close to the shell's behaviour. The PC has
 * one paired phone („Pixel 7“), off until switched on; it delivers only while the module is on,
 * the phone is granted, not paused and connected. The phone has its PC.
 */
export function createFakeExchange(side: 'pc' | 'phone'): ExchangeService {
  let counter = 1;
  let enabled = false;
  const device: ExchangeDevice = {
    id: FAKE_PEER,
    name: 'Pixel 7',
    lastSeen: Math.floor(Date.now() / 1000),
    on: false,
    paused: false,
    connected: true,
  };
  const inbox: ExchangeItem[] = [];
  const answers: ExchangeAnswer[] = [];
  const queued: { peer: string; id: string; state: 'queued' | 'full' }[] = [];
  const listeners = new Set<() => void>();
  let phoneEvents: ((e: ExchangeEvent) => void) | null = null;
  let refuse: string | null = null;

  const changed = () => {
    if (side === 'pc') for (const l of listeners) l();
    else phoneEvents?.({ type: 'received' });
  };
  const deliverable = () => enabled && device.on && !device.paused && device.connected;
  const answerPc = (id: string, state: ExchangeAnswerState) => {
    const at = queued.findIndex((q) => q.id === id);
    if (at < 0) return;
    const q = queued[at]!;
    if (state === 'full') q.state = 'full';
    else queued.splice(at, 1);
    answers.push({ peer: q.peer, id, state });
    changed();
  };
  const flush = () => {
    if (!deliverable()) return;
    for (const q of [...queued])
      if (q.state === 'queued') setTimeout(() => answerPc(q.id, 'delivered'), 300);
  };

  const hooks: FakeExchangeHooks = {
    arrive(kind, body) {
      inbox.push({ peer: FAKE_PEER, id: hex(1_000_000 + counter++), kind, body, at: Date.now() });
      changed();
    },
    setConnected(on) {
      device.connected = on;
      flush();
    },
    answer(id, state) {
      if (side === 'pc') answerPc(id, state);
      else phoneEvents?.({ type: 'answer', id, state });
    },
    refuseOpen(code) {
      refuse = code;
    },
    closeSession(reason, minutes = null) {
      const events = phoneEvents;
      phoneEvents = null;
      events?.({ type: 'closed', reason, minutes });
    },
  };
  try {
    (globalThis as { __exchangeFake?: FakeExchangeHooks }).__exchangeFake = hooks;
  } catch {
    // frozen global: tests simply cannot inject
  }

  return {
    side,
    status: async () => {
      if (side !== 'pc') throw new Error('unsupported');
      return { running: true, enabled, devices: [{ ...device }], queued: [...queued] };
    },
    send: async (peer, item) => {
      if (side !== 'pc') throw new Error('unsupported');
      if (peer !== FAKE_PEER) throw new Error('not-found');
      if (!valid(item.kind, item.body)) throw new Error('bad-item');
      if (!queued.some((q) => q.id === item.id))
        queued.push({ peer, id: item.id, state: 'queued' });
      flush();
    },
    take: async () => ({ items: [...inbox], answers: [...answers] }),
    confirm: async (items, done = []) => {
      for (let i = inbox.length - 1; i >= 0; i--) {
        const it = inbox[i];
        if (it && items.some((k) => k.peer === it.peer && k.id === it.id)) inbox.splice(i, 1);
      }
      for (let i = answers.length - 1; i >= 0; i--) {
        const a = answers[i];
        if (a && done.some((k) => k.peer === a.peer && k.id === a.id)) answers.splice(i, 1);
      }
    },
    setEnabled: async (on) => {
      enabled = on;
      flush();
    },
    setDevice: async (_id, on, paused) => {
      device.on = on;
      device.paused = paused;
      flush();
    },
    // the phone's shell says nothing outside a session (as the real one)
    onChanged: (cb) => {
      if (side !== 'pc') return () => undefined;
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    open: async (onEvent) => {
      if (side !== 'phone') throw new Error('unsupported');
      if (refuse) throw new Error(refuse);
      phoneEvents = onEvent;
      let closed = false;
      const mine = onEvent;
      const alive = () => !closed && phoneEvents === mine;
      return {
        send: async (item) => {
          if (!alive()) throw new Error('closed');
          if (!valid(item.kind, item.body)) throw new Error('bad-item');
          setTimeout(() => {
            if (alive()) onEvent({ type: 'answer', id: item.id, state: 'delivered' });
          }, 200);
        },
        ping: async () => {
          if (!alive()) throw new Error('closed');
        },
        close: async () => {
          closed = true;
          if (phoneEvents === mine) phoneEvents = null;
        },
      };
    },
  };
}
