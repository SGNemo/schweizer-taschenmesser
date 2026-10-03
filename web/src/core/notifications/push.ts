/**
 * Web Push through the user's own sync server (optional). The app uploads its upcoming
 * notifications (time + payload) to the server, which delivers them via the browser's push service
 * when the app is closed. Without it, notifications only fire while the app is open.
 *
 * Privacy: titles and texts reach the sync server; with end-to-end encryption enabled they are
 * encrypted with the sync key (the service worker decrypts them, see `pushPayload.ts`).
 */
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { activeManifests } from '@/core/modules/contributions';
import { loadModuleStates } from '@/core/modules/activation';
import type { DueNotification } from '@/core/modules/types';
import { collectDue } from './collect';
import { getPlatform } from '@/core/platform';
import { normalizeServerUrl } from '@/core/sync/adapters/selfHosted';
import { encryptValue, fromBase64Url } from '@/core/sync/crypto';
import { loadSyncConfig, type SyncConfig } from '@/core/sync/service';
import { now as clockNow } from '@/core/time/now';
import { pushAad, type PushPayload } from './pushPayload';
import { startScheduleTriggers } from './triggers';

const CONFIG_KEY = 'pushConfig';
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_ITEMS = 500;

export type PushErrorCode =
  | 'unsupported'
  | 'needs-sync'
  | 'denied'
  | 'unauthorized'
  | 'network'
  | 'server'
  | 'subscribe-failed';

export class PushError extends Error {
  constructor(
    readonly code: PushErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'PushError';
  }
}

interface PushConfig {
  endpoint: string;
  /** VAPID public key the subscription was made with; a different server key needs a new subscription. */
  serverKey: string;
}

export interface ScheduleItem {
  key: string;
  at: number;
  payload: string;
}

export interface PushRemote {
  getKey(): Promise<string>;
  putSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<void>;
  unsubscribe(endpoint: string): Promise<void>;
  /** Returns false when the server does not know the subscription (e.g. after a database loss). */
  putSchedule(endpoint: string, items: ScheduleItem[]): Promise<boolean>;
  test(endpoint: string): Promise<boolean>;
}

export function createPushRemote(
  config: Pick<SyncConfig, 'url' | 'token'>,
  fetchFn: typeof fetch = (input, init) => getPlatform().fetch(input, init),
): PushRemote {
  const base = normalizeServerUrl(config.url) ?? config.url;
  async function request(path: string, method: string, body?: unknown, ok: number[] = []) {
    let res: Response;
    try {
      res = await fetchFn(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${config.token}`,
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new PushError('network');
    }
    if (res.status === 401) throw new PushError('unauthorized');
    if (!res.ok && !ok.includes(res.status)) throw new PushError('server', `HTTP ${res.status}`);
    return res;
  }
  return {
    async getKey() {
      return ((await (await request('/v1/push/key', 'GET')).json()) as { publicKey: string })
        .publicKey;
    },
    async putSubscription(sub) {
      await request('/v1/push/subscription', 'PUT', sub);
    },
    async unsubscribe(endpoint) {
      await request('/v1/push/unsubscribe', 'POST', { endpoint });
    },
    async putSchedule(endpoint, items) {
      const res = await request('/v1/push/schedule', 'PUT', { endpoint, items }, [404]);
      return res.status !== 404;
    },
    async test(endpoint) {
      const res = await request('/v1/push/test', 'POST', { endpoint }, [404, 502, 503]);
      return res.ok;
    },
  };
}

/** The pieces of the platform the service talks to; replaced by fakes in tests. */
export interface PushDeps {
  database: TaschenmesserDB;
  now(): number;
  supported(): boolean;
  permission(): NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  registration(): Promise<Pick<ServiceWorkerRegistration, 'pushManager'> | undefined>;
  remote(config: SyncConfig): PushRemote;
  loadDue(range: { from: number; to: number }): Promise<DueNotification[]>;
}

export function defaultPushDeps(): PushDeps {
  return {
    database: defaultDb,
    now: clockNow,
    // Web Push is a browser feature; the native app schedules local notifications itself.
    supported: () =>
      !getPlatform().isNative &&
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof PushManager !== 'undefined' &&
      typeof Notification !== 'undefined',
    permission: () => Notification.permission,
    requestPermission: () => Notification.requestPermission(),
    registration: async () => (await navigator.serviceWorker.getRegistration()) ?? undefined,
    remote: (config) => createPushRemote(config),
    async loadDue(range) {
      return collectDue(range, activeManifests(await loadModuleStates()));
    },
  };
}

/* ------------------------------------- config ------------------------------------- */

async function loadConfig(database: TaschenmesserDB): Promise<PushConfig | undefined> {
  return (
    await database.table<{ key: string; value: PushConfig }, string>('_secrets').get(CONFIG_KEY)
  )?.value;
}
const saveConfig = (database: TaschenmesserDB, value: PushConfig) =>
  database.table('_secrets').put({ key: CONFIG_KEY, value });
const clearConfig = (database: TaschenmesserDB) => database.table('_secrets').delete(CONFIG_KEY);

export type PushStatus =
  | { state: 'unsupported' }
  | { state: 'needs-sync' }
  | { state: 'denied' }
  | { state: 'off' }
  | { state: 'on'; endpoint: string };

export async function pushStatus(deps: PushDeps = defaultPushDeps()): Promise<PushStatus> {
  if (!deps.supported()) return { state: 'unsupported' };
  const [sync, config] = await Promise.all([
    loadSyncConfig(deps.database),
    loadConfig(deps.database),
  ]);
  if (!sync) return { state: 'needs-sync' };
  if (deps.permission() === 'denied') return { state: 'denied' };
  return config ? { state: 'on', endpoint: config.endpoint } : { state: 'off' };
}

/* ------------------------------------ schedule ------------------------------------ */

/** Builds the upload: the next two weeks of notifications, payloads encrypted when a sync key exists. */
export async function buildSchedule(
  due: readonly DueNotification[],
  from: number,
  key?: CryptoKey,
): Promise<ScheduleItem[]> {
  const unique = new Map<string, DueNotification>();
  for (const n of due) if (n.at > from && !unique.has(n.key)) unique.set(n.key, n);
  const items = [...unique.values()].sort((a, b) => a.at - b.at).slice(0, MAX_ITEMS);
  return Promise.all(
    items.map(async (n) => {
      const payload: PushPayload = { title: n.title, body: n.body, url: n.url };
      return {
        key: n.key,
        at: n.at,
        payload: key ? await encryptValue(key, pushAad(n.key), payload) : JSON.stringify(payload),
      };
    }),
  );
}

/** Uploads the current schedule. Safe to call at any time; does nothing while push is off. */
export async function syncPushSchedule(deps: PushDeps = defaultPushDeps()): Promise<boolean> {
  const [sync, config] = await Promise.all([
    loadSyncConfig(deps.database),
    loadConfig(deps.database),
  ]);
  if (!sync || !config) return false;
  const remote = deps.remote(sync);
  const from = deps.now();
  const items = await buildSchedule(
    await deps.loadDue({ from, to: from + WINDOW_MS }),
    from,
    sync.key,
  );
  if (await remote.putSchedule(config.endpoint, items)) return true;
  // The server lost its subscriptions (new database): register again, then retry once.
  const sub = await (await deps.registration())?.pushManager.getSubscription();
  if (!sub) return false;
  await remote.putSubscription(sub.toJSON() as Parameters<PushRemote['putSubscription']>[0]);
  return remote.putSchedule(config.endpoint, items);
}

/* ---------------------------------- enable / disable ---------------------------------- */

export async function enablePush(deps: PushDeps = defaultPushDeps()): Promise<void> {
  if (!deps.supported()) throw new PushError('unsupported');
  const sync = await loadSyncConfig(deps.database);
  if (!sync) throw new PushError('needs-sync');
  let permission = deps.permission();
  if (permission === 'default') permission = await deps.requestPermission();
  if (permission !== 'granted') throw new PushError('denied');

  const remote = deps.remote(sync);
  const serverKey = await remote.getKey();
  const reg = await deps.registration();
  if (!reg) throw new PushError('subscribe-failed', 'no service worker');

  const previous = await loadConfig(deps.database);
  let sub = await reg.pushManager.getSubscription();
  if (sub && previous?.serverKey !== serverKey) {
    await sub.unsubscribe(); // made for another server key: the browser would refuse a mixed-up one
    sub = null;
  }
  try {
    sub ??= await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: fromBase64Url(serverKey),
    });
  } catch (e) {
    throw new PushError('subscribe-failed', e instanceof Error ? e.message : String(e));
  }
  await remote.putSubscription(sub.toJSON() as Parameters<PushRemote['putSubscription']>[0]);
  await saveConfig(deps.database, { endpoint: sub.endpoint, serverKey });
  await syncPushSchedule(deps);
}

export async function disablePush(deps: PushDeps = defaultPushDeps()): Promise<void> {
  const [sync, config] = await Promise.all([
    loadSyncConfig(deps.database),
    loadConfig(deps.database),
  ]);
  await clearConfig(deps.database);
  const sub = await (await deps.registration())?.pushManager.getSubscription();
  await sub?.unsubscribe().catch(() => undefined);
  if (sync && config) {
    // Best effort: an unreachable server must not keep push "on" on this device.
    await deps
      .remote(sync)
      .unsubscribe(config.endpoint)
      .catch(() => undefined);
  }
}

/** Sends a message through the whole chain (server → push service → this browser). */
export async function sendTestPush(deps: PushDeps = defaultPushDeps()): Promise<boolean> {
  const [sync, config] = await Promise.all([
    loadSyncConfig(deps.database),
    loadConfig(deps.database),
  ]);
  if (!sync || !config) throw new PushError('needs-sync');
  return deps.remote(sync).test(config.endpoint);
}

/* ------------------------------------- triggers ------------------------------------- */

/** Keeps the server's schedule current (see `startScheduleTriggers`). */
export function startPushSync(deps: PushDeps = defaultPushDeps()): () => void {
  return startScheduleTriggers(
    () =>
      void syncPushSchedule(deps).catch((e) => console.warn('[push] schedule upload failed', e)),
    deps.database,
  );
}
