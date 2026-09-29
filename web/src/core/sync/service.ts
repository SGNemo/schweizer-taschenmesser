import { liveQuery } from 'dexie';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import type { StorageAdapter } from '@/core/storage/types';
import { now } from '@/core/time/now';
import { SelfHostedAdapter, normalizeServerUrl, type VaultInfo } from './adapters/selfHosted';
import { PBKDF2_ITERATIONS, deriveKey, makeVaultCheck, newSalt, verifyVaultCheck } from './crypto';
import { runSync } from './engine';
import { useSyncStatus } from './status';
import { SyncError, type SyncAdapter } from './types';

/** Connection settings of this device. Local only – lives in `_secrets`, is never synced or exported. */
export interface SyncConfig {
  kind: 'selfHosted';
  url: string;
  token: string;
  /** Non-extractable AES-GCM key when end-to-end encryption is on. */
  key?: CryptoKey;
}

/** The server API the service needs beyond the SyncAdapter contract. */
export interface RemoteServer extends SyncAdapter {
  health(): Promise<void>;
  getVault(): Promise<{ epoch: string; vault: VaultInfo | null }>;
  putVault(vault: VaultInfo): Promise<boolean>;
  reset(): Promise<void>;
}

export interface SyncServiceDeps {
  database: TaschenmesserDB;
  storage: StorageAdapter;
  remote: (url: string, token: string) => RemoteServer;
  /** PBKDF2 iterations; lowered in tests. */
  iterations: number;
}

export function defaultDeps(): SyncServiceDeps {
  return {
    database: defaultDb,
    storage: new DexieStorageAdapter(defaultDb),
    remote: (url, token) => new SelfHostedAdapter(url, token),
    iterations: PBKDF2_ITERATIONS,
  };
}

const CONFIG_KEY = 'syncConfig';
const LAST_SYNC_KEY = 'sync.lastSyncAt';
export const MIN_PASSPHRASE_LENGTH = 8;

/* ------------------------------ config persistence ------------------------------ */

export async function loadSyncConfig(
  database: TaschenmesserDB = defaultDb,
): Promise<SyncConfig | undefined> {
  return (
    await database.table<{ key: string; value: SyncConfig }, string>('_secrets').get(CONFIG_KEY)
  )?.value;
}

async function saveSyncConfig(database: TaschenmesserDB, config: SyncConfig): Promise<void> {
  await database.table('_secrets').put({ key: CONFIG_KEY, value: config });
}

async function clearSyncConfig(database: TaschenmesserDB): Promise<void> {
  await database.table('_secrets').delete(CONFIG_KEY);
}

/* ------------------------------------ syncing ------------------------------------ */

let chain: Promise<unknown> = Promise.resolve();

/** One sync at a time: in this tab via a promise chain, across tabs via the Web Locks API. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('taschenmesser-sync', fn)
      : fn();
  const next = chain.then(run, run);
  chain = next.catch(() => undefined);
  return next;
}

/** Runs one sync cycle if sync is configured; never throws (errors go to the status store). */
export function syncNow(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  return exclusive(async () => {
    const status = useSyncStatus.getState();
    const config = await loadSyncConfig(deps.database);
    if (!config) {
      status.set({
        phase: 'off',
        server: undefined,
        encrypted: false,
        error: undefined,
        pending: 0,
      });
      return;
    }
    status.set({
      phase: 'syncing',
      server: new URL(config.url).host,
      encrypted: Boolean(config.key),
    });
    try {
      await runSync({
        storage: deps.storage,
        adapter: deps.remote(config.url, config.token),
        key: config.key,
      });
      const at = now();
      await deps.database.table('_meta').put({ key: LAST_SYNC_KEY, value: at });
      status.set({
        phase: 'idle',
        lastSyncAt: at,
        error: undefined,
        pending: await deps.storage.pendingCount(),
      });
    } catch (e) {
      const code = e instanceof SyncError ? e.code : 'unknown';
      if (code === 'unknown') console.error('[sync] failed', e);
      status.set({ phase: 'error', error: code, pending: await deps.storage.pendingCount() });
    }
  });
}

/** Loads persisted status after a reload so the UI is not blank until the first sync finishes. */
export async function restoreSyncStatus(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  const config = await loadSyncConfig(deps.database);
  const last = (
    await deps.database.table<{ key: string; value: number }, string>('_meta').get(LAST_SYNC_KEY)
  )?.value;
  useSyncStatus.getState().set(
    config
      ? {
          phase: 'idle',
          server: new URL(config.url).host,
          encrypted: Boolean(config.key),
          lastSyncAt: last,
          pending: await deps.storage.pendingCount(),
        }
      : { phase: 'off', server: undefined, encrypted: false, lastSyncAt: undefined },
  );
}

const INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 1500;

/**
 * Keeps the device in sync: on start, every minute, when coming back online or visible, and
 * shortly after local changes. Returns a function that stops everything.
 */
export function startSync(deps: SyncServiceDeps = defaultDeps()): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined;
  const tick = () => void syncNow(deps);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick();
  };

  void restoreSyncStatus(deps).then(tick);
  const interval = setInterval(tick, INTERVAL_MS);
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', onVisible);

  // Local writes queue records in the outbox; sync soon after they settle.
  const sub = liveQuery(() => deps.storage.pendingCount()).subscribe({
    next(pending) {
      useSyncStatus.getState().set({ pending });
      if (pending > 0 && useSyncStatus.getState().phase !== 'off') {
        clearTimeout(debounce);
        debounce = setTimeout(tick, DEBOUNCE_MS);
      }
    },
    error: (e) => console.error('[sync] outbox stream failed', e),
  });

  return () => {
    clearInterval(interval);
    clearTimeout(debounce);
    window.removeEventListener('online', tick);
    document.removeEventListener('visibilitychange', onVisible);
    sub.unsubscribe();
  };
}

/* ----------------------------------- connecting ----------------------------------- */

export interface ConnectParams {
  url: string;
  token: string;
  /** Turn on end-to-end encryption (only possible on an empty server). */
  encrypt: boolean;
  passphrase?: string;
}

export type ConnectFailure =
  | 'invalid-url'
  | 'unreachable'
  | 'unauthorized'
  | 'passphrase-required'
  | 'passphrase-too-short'
  | 'wrong-passphrase'
  | 'server-has-plain-data'
  | 'server-error';

export type ConnectResult =
  { ok: true; encrypted: boolean } | { ok: false; reason: ConnectFailure };

const failure = (reason: ConnectFailure): ConnectResult => ({ ok: false, reason });

function mapError(e: unknown): ConnectResult {
  if (e instanceof SyncError) {
    if (e.code === 'network') return failure('unreachable');
    if (e.code === 'unauthorized') return failure('unauthorized');
  }
  return failure('server-error');
}

/**
 * Validates the server, sets up or joins the encryption vault, stores the configuration and runs
 * the first sync. The server decides whether it is encrypted: a server that already has a vault
 * always needs the passphrase; encryption can only be introduced on an empty server.
 */
export async function connect(
  params: ConnectParams,
  deps: SyncServiceDeps = defaultDeps(),
): Promise<ConnectResult> {
  const url = normalizeServerUrl(params.url);
  if (!url) return failure('invalid-url');
  const token = params.token.trim();
  if (!token) return failure('unauthorized');
  const remote = deps.remote(url, token);

  let key: CryptoKey | undefined;
  try {
    await remote.health();
    let info = await remote.getVault();
    for (let attempt = 0; attempt < 2; attempt++) {
      if (info.vault) {
        if (!params.passphrase) return failure('passphrase-required');
        key = await deriveKey(params.passphrase, info.vault.salt, deps.iterations);
        if (!(await verifyVaultCheck(key, info.vault.check))) return failure('wrong-passphrase');
        break;
      }
      if (!params.encrypt) break;
      if (!params.passphrase || params.passphrase.length < MIN_PASSPHRASE_LENGTH)
        return failure('passphrase-too-short');
      if ((await remote.pull(0, 1)).ops.length > 0) return failure('server-has-plain-data');
      const salt = newSalt();
      key = await deriveKey(params.passphrase, salt, deps.iterations);
      if (await remote.putVault({ salt, check: await makeVaultCheck(key) })) break;
      // Another device created the vault a moment earlier: join that one instead.
      info = await remote.getVault();
      key = undefined;
    }
  } catch (e) {
    return mapError(e);
  }

  await saveSyncConfig(deps.database, { kind: 'selfHosted', url, token, key });
  // Treat the server as new: cursor 0 and a full upload on the first cycle.
  await deps.storage.setEpoch(undefined);
  await deps.storage.setCursor(0);
  await syncNow(deps);
  return { ok: true, encrypted: Boolean(key) };
}

/** Stops syncing on this device. Local data stays; the server is not touched. */
export async function disconnect(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  await exclusive(async () => {
    await clearSyncConfig(deps.database);
    await deps.storage.setEpoch(undefined);
    await deps.storage.setCursor(0);
  });
  useSyncStatus
    .getState()
    .set({ phase: 'off', server: undefined, encrypted: false, error: undefined, pending: 0 });
}

/** Wipes all data and the vault on the server (this device's data becomes the new source). */
export async function resetServer(
  params: Pick<ConnectParams, 'url' | 'token'>,
  deps: SyncServiceDeps = defaultDeps(),
): Promise<ConnectResult | undefined> {
  const url = normalizeServerUrl(params.url);
  if (!url) return failure('invalid-url');
  try {
    await deps.remote(url, params.token.trim()).reset();
  } catch (e) {
    return mapError(e);
  }
  return undefined;
}
