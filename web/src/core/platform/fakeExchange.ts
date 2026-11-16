import type {
  ExchangeAnswer,
  ExchangeDevice,
  ExchangeEvent,
  ExchangeItem,
  ExchangeService,
} from './types';

/** The demo phone of the fake PC and the demo PC of the fake phone (same id both ways). */
export const FAKE_PEER = 'ab'.repeat(32);

/** Hooks for e2e tests (E2E builds only): let something arrive from the other device. */
export interface FakeExchangeHooks {
  arrive(kind: ExchangeItem['kind'], body: string): void;
}

const hex = (n: number): string => n.toString(16).padStart(32, '0');

/**
 * E2E builds only: device exchange without a network. The PC has one paired phone („Pixel 7“),
 * off until switched on; the phone has its PC. Sent items are answered `delivered` after a moment.
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
  const changed = () => {
    for (const l of listeners) l();
    phoneEvents?.({ type: 'received' });
  };

  const hooks: FakeExchangeHooks = {
    arrive(kind, body) {
      inbox.push({ peer: FAKE_PEER, id: hex(1_000_000 + counter++), kind, body, at: Date.now() });
      changed();
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
      queued.push({ peer, id: item.id, state: 'queued' });
      setTimeout(() => {
        const at = queued.findIndex((q) => q.id === item.id);
        if (at >= 0) queued.splice(at, 1);
        answers.push({ peer, id: item.id, state: 'delivered' });
        changed();
      }, 300);
    },
    take: async () => ({ items: [...inbox], answers: answers.splice(0) }),
    confirm: async (ids) => {
      for (let i = inbox.length - 1; i >= 0; i--) {
        if (ids.includes(inbox[i]?.id ?? '')) inbox.splice(i, 1);
      }
    },
    setEnabled: async (on) => {
      enabled = on;
    },
    setDevice: async (_id, on, paused) => {
      device.on = on;
      device.paused = paused;
    },
    onChanged: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    open: async (onEvent) => {
      if (side !== 'phone') throw new Error('unsupported');
      phoneEvents = onEvent;
      return {
        send: async (item) => {
          setTimeout(() => onEvent({ type: 'answer', id: item.id, state: 'delivered' }), 200);
        },
        ping: async () => undefined,
        close: async () => {
          phoneEvents = null;
        },
      };
    },
  };
}
