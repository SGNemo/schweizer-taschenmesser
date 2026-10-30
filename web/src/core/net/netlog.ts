/**
 * Local connection log and "Netzwerk sperren". Every request that goes through `getPlatform().fetch`
 * is noted with time, host, reason and size, never with path, query, headers or content. By default
 * the list lives in memory for this session; "Protokoll auf dem Gerät behalten" keeps the last
 * entries in `localStorage` (device-local, never synced, not in backups, not in diagnostics).
 *
 * The block switch makes the same wrapper refuse every request before it is sent. Requests the
 * Rust side makes itself (updater, model download) are announced from their JS call sites with
 * `assertNetworkAllowed`, so they are blocked and listed too, only their size is unknown.
 *
 * This file must not import the platform (the platform wraps its `fetch` with `loggedFetch`).
 */
import { create } from 'zustand';
import { now } from '@/core/time/now';

export type NetReason =
  | 'update'
  | 'sync'
  | 'push'
  | 'calendar'
  | 'connector'
  | 'ai'
  | 'weather'
  | 'maps'
  | 'currency'
  | 'ip'
  | 'download'
  | 'other';

/** HTTP status, `blocked` (refused by the switch), `error` (no answer), `native` (made by the shell, size unknown). */
export type NetStatus = number | 'blocked' | 'error' | 'native';

export interface NetEntry {
  /** Epoch ms. */
  at: number;
  /** Host (and port) only. */
  host: string;
  reason: NetReason;
  /** Bytes of the request body (0 when there is none or the size is unknown). */
  out: number;
  /** Bytes of the answer when the server named them. */
  in?: number;
  status: NetStatus;
}

export const MAX_NET_ENTRIES = 200;
const BLOCK_KEY = 'tm-net-block';
const KEEP_KEY = 'tm-net-log-keep';
const LOG_KEY = 'tm-net-log';

/** A blocked request fails like a network error (callers already handle `TypeError`). */
export class NetBlockedError extends TypeError {
  constructor() {
    super('network blocked');
    this.name = 'NetBlockedError';
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage may be blocked; the switch and the list still work for this session.
  }
}

const STATUSES = new Set(['blocked', 'error', 'native']);

function readStored(): NetEntry[] {
  try {
    const raw: unknown = JSON.parse(read(LOG_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw
      .filter(
        (e): e is NetEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as NetEntry).at === 'number' &&
          typeof (e as NetEntry).host === 'string' &&
          typeof (e as NetEntry).reason === 'string' &&
          typeof (e as NetEntry).out === 'number' &&
          (typeof (e as NetEntry).status === 'number' ||
            STATUSES.has(String((e as NetEntry).status))),
      )
      .slice(0, MAX_NET_ENTRIES);
  } catch {
    return [];
  }
}

interface NetLogState {
  entries: NetEntry[];
  blocked: boolean;
  keep: boolean;
}

const keepInitially = read(KEEP_KEY) === '1';

export const useNetLog = create<NetLogState>(() => ({
  entries: keepInitially ? readStored() : [],
  blocked: read(BLOCK_KEY) === '1',
  keep: keepInitially,
}));

export const isNetworkBlocked = (): boolean => useNetLog.getState().blocked;

export function setNetworkBlocked(blocked: boolean): void {
  write(BLOCK_KEY, blocked ? '1' : null);
  useNetLog.setState({ blocked });
}

/** Keeping the list on the device is opt-in; switching it off deletes what was stored. */
export function setKeepNetLog(keep: boolean): void {
  write(KEEP_KEY, keep ? '1' : null);
  write(LOG_KEY, keep ? JSON.stringify(useNetLog.getState().entries) : null);
  useNetLog.setState({ keep });
}

export function clearNetLog(): void {
  write(LOG_KEY, useNetLog.getState().keep ? '[]' : null);
  useNetLog.setState({ entries: [] });
}

export function recordNet(entry: Omit<NetEntry, 'at'>): void {
  const { entries, keep } = useNetLog.getState();
  const next = [{ at: now(), ...entry }, ...entries].slice(0, MAX_NET_ENTRIES);
  if (keep) write(LOG_KEY, JSON.stringify(next));
  useNetLog.setState({ entries: next });
}

/* ------------------------------ what a request is for ------------------------------ */

const HOST_REASONS: [RegExp, NetReason][] = [
  [/^(api\.)?github\.com$|(^|\.)githubusercontent\.com$/, 'update'],
  [/(^|\.)open-meteo\.com$/, 'weather'],
  [/^(tile|nominatim)\.openstreetmap\.org$/, 'maps'],
  [/^api\.frankfurter\.(dev|app)$/, 'currency'],
  [/^api\.ipify\.org$/, 'ip'],
  [/(^|\.)huggingface\.co$/, 'download'],
  [/^api\.(openai|anthropic)\.com$|^generativelanguage\.googleapis\.com$|:11434$/, 'ai'],
  [
    /(^|\.)googleapis\.com$|^accounts\.google\.com$|(^|\.)spotify\.com$|(^|\.)scdn\.co$/,
    'connector',
  ],
];

/** Host (with port) and reason of a URL. Pure, so the log never needs a caller to name the reason. */
export function describeRequest(url: string): { host: string; reason: NetReason } {
  let parsed: URL;
  try {
    parsed = new URL(url, typeof location === 'undefined' ? undefined : location.href);
  } catch {
    return { host: '?', reason: 'other' };
  }
  const host = parsed.host.toLowerCase();
  const hit = HOST_REASONS.find(([re]) => re.test(host));
  if (hit) return { host, reason: hit[1] };
  // The user's own sync server is recognised by its API paths, whatever its address is.
  if (parsed.pathname.startsWith('/v1/proxy')) return { host, reason: 'calendar' };
  if (parsed.pathname.startsWith('/v1/push')) return { host, reason: 'push' };
  if (parsed.pathname.startsWith('/v1/')) return { host, reason: 'sync' };
  return { host, reason: 'other' };
}

function sizeOf(body: BodyInit | null | undefined): number {
  if (body == null) return 0;
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  return 0;
}

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

/** Notes the request in the list, or refuses it while the network is blocked. */
export function loggedFetch(inner: typeof fetch): typeof fetch {
  return async (input, init) => {
    const { host, reason } = describeRequest(urlOf(input));
    const out = sizeOf(init?.body);
    if (isNetworkBlocked()) {
      recordNet({ host, reason, out: 0, status: 'blocked' });
      throw new NetBlockedError();
    }
    try {
      const res = await inner(input, init);
      const length = Number(res.headers.get('content-length'));
      recordNet({
        host,
        reason,
        out,
        status: res.status,
        ...(Number.isFinite(length) && length > 0 ? { in: length } : {}),
      });
      return res;
    } catch (e) {
      recordNet({ host, reason, out, status: 'error' });
      throw e;
    }
  };
}

/**
 * For requests the native shell makes itself (updater, model download): called right before, it
 * lists them and throws `NetBlockedError` while the network is blocked.
 */
export function assertNetworkAllowed(host: string, reason: NetReason): void {
  if (isNetworkBlocked()) {
    recordNet({ host, reason, out: 0, status: 'blocked' });
    throw new NetBlockedError();
  }
  recordNet({ host, reason, out: 0, status: 'native' });
}
