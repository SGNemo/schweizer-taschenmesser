/**
 * Web Push: the app uploads its upcoming notifications (time + opaque payload); this service sends
 * each one to the browser's push service at its time, so reminders arrive while the app is closed.
 * The payload is opaque to the server – with end-to-end encryption the client encrypts it.
 */
import { createECDH } from 'node:crypto';
import webpush from 'web-push';
import type { ScheduledPush, Store } from './store.js';

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

/** A P-256 key pair in the base64url form the Web Push protocol (VAPID) uses. */
export function generateVapidKeys(): VapidKeys {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: ecdh.getPrivateKey().toString('base64url'),
  };
}

/** Keys from the environment win; otherwise they are generated once and kept in the database. */
export function ensureVapidKeys(
  store: Store,
  fromEnv?: { publicKey?: string; privateKey?: string },
): VapidKeys {
  if (fromEnv?.publicKey && fromEnv.privateKey) {
    return { publicKey: fromEnv.publicKey, privateKey: fromEnv.privateKey };
  }
  const existing = store.vapid();
  if (existing) return existing;
  const keys = generateVapidKeys();
  store.setVapid(keys);
  return keys;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushSender {
  /** Rejects with an error carrying `statusCode` (404/410 = the subscription is gone). */
  send(target: PushTarget, body: string): Promise<void>;
}

export function requestOptions(keys: VapidKeys, subject: string): webpush.RequestOptions {
  return { vapidDetails: { subject, ...keys }, TTL: 60 * 60, urgency: 'normal', timeout: 10_000 };
}

export function createWebPushSender(keys: VapidKeys, subject: string): PushSender {
  const options = requestOptions(keys, subject);
  return {
    async send(target, body) {
      await webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        body,
        options,
      );
    },
  };
}

/** What the service worker receives. */
export function messageFor(item: Pick<ScheduledPush, 'key' | 'payload'>): string {
  return JSON.stringify({ v: 1, key: item.key, payload: item.payload });
}

const STALE_MS = 24 * 60 * 60 * 1000;
const SENT_MEMORY_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 5;

export interface PushService {
  /** Sends everything that is due; returns the number of notifications delivered. */
  tick(): Promise<number>;
  start(): void;
  stop(): void;
}

export function createPushService(opts: {
  store: Store;
  sender: PushSender;
  now?: () => number;
  intervalMs?: number;
  onError?: (e: unknown) => void;
}): PushService {
  const { store, sender } = opts;
  const now = opts.now ?? Date.now;
  let timer: NodeJS.Timeout | undefined;
  let running = false;

  async function tick(): Promise<number> {
    if (running) return 0;
    running = true;
    try {
      const at = now();
      // Notifications that are more than a day late are not worth showing any more.
      store.purgePush(at, at - STALE_MS, at - SENT_MEMORY_MS);
      let delivered = 0;
      for (const item of store.dueItems(at, 100)) {
        const sub = store.getSubscription(item.endpoint);
        if (!sub) {
          store.markFailed(item.endpoint, item.key, 1);
          continue;
        }
        try {
          await sender.send(sub, messageFor(item));
          store.markSent(item.endpoint, item.key, at);
          delivered++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) store.removeSubscription(item.endpoint);
          else store.markFailed(item.endpoint, item.key, MAX_ATTEMPTS);
          opts.onError?.(e);
        }
      }
      return delivered;
    } finally {
      running = false;
    }
  }

  return {
    tick,
    start() {
      if (timer) return;
      timer = setInterval(
        () => void tick().catch((e) => opts.onError?.(e)),
        opts.intervalMs ?? 30_000,
      );
      timer.unref();
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
}
