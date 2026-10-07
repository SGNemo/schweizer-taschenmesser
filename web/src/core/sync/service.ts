import { t } from '@/strings';
import { liveQuery } from 'dexie';
import { runAppMigrations } from '@/core/db/appMigrations';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { DexieStorageAdapter } from '@/core/storage/dexie';
import type { StorageAdapter } from '@/core/storage/types';
import { now } from '@/core/time/now';
import { getDeviceContext } from '@/core/db/device';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { SelfHostedAdapter, normalizeServerUrl, type VaultInfo } from './adapters/selfHosted';
import { makeVaultCheck, verifyVaultCheck } from './crypto';
import { purgeConflicts } from './conflicts';
import { runSync } from './engine';
import { useSyncStatus } from './status';
import { purgeTombstones } from './tombstones';
import {
  SyncError,
  type DeviceInfo,
  type ServerInfo,
  type ServerStatus,
  type SyncAdapter,
} from './types';
import { deriveVaultKey, newVaultParams, toVaultInfo, vaultParams } from './vaultKey';

/** Connection settings of this device. Local only – lives in `_secrets`, is never synced or exported. */
export interface SyncConfig {
  kind: 'selfHosted';
  url: string;
  token: string;
  /** Non-extractable AES-GCM key when end-to-end encryption is on. */
  key?: CryptoKey;
  /** Set when the server knows this device (protocol 2): `token` is then its own, revocable token. */
  deviceId?: string;
  deviceName?: string;
}

/** The server API the service needs beyond the SyncAdapter contract. */
export interface RemoteServer extends SyncAdapter {
  health(): Promise<void>;
  getVault(): Promise<{ epoch: string; vault: VaultInfo | null }>;
  putVault(vault: VaultInfo): Promise<boolean>;
  reset(): Promise<void>;
  /* Protocol 2 (optional: a server or test double without them behaves like a legacy server). */
  info?(): Promise<ServerInfo | undefined>;
  registerDevice?(device: {
    id: string;
    name: string;
  }): Promise<{ token: string } | 'exists' | 'forbidden'>;
  rotateDevice?(id: string): Promise<{ token: string } | undefined>;
  listDevices?(): Promise<DeviceInfo[]>;
  revokeDevice?(id: string): Promise<boolean>;
  status?(): Promise<ServerStatus>;
}

export interface SyncServiceDeps {
  database: TaschenmesserDB;
  storage: StorageAdapter;
  remote: (url: string, token: string) => RemoteServer;
  /** Deprecated and ignored: the sync vault uses Argon2id since protocol 2. Kept so callers compile. */
  iterations?: number;
  /** Argon2id parameters for a new vault; lowered in tests (only accepted in test mode). */
  kdf?: { m?: number; t?: number; p?: number };
}

export function defaultDeps(): SyncServiceDeps {
  return {
    database: defaultDb,
    storage: new DexieStorageAdapter(defaultDb),
    remote: (url, token) => new SelfHostedAdapter(url, token),
  };
}

const CONFIG_KEY = 'syncConfig';
const LAST_SYNC_KEY = 'sync.lastSyncAt';
export const MIN_PASSPHRASE_LENGTH = 12;

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

/** Errors that can heal by themselves; everything else needs the user (token, passphrase, lock). */
const RETRYABLE = new Set(['network', 'server', 'rate-limited', 'unknown']);

/** Delay before retry number `failures` (1-based): 5 s, 10 s, 20 s … up to 5 min, with ±20 % jitter. */
export function backoffMs(failures: number, random: () => number = Math.random): number {
  const base = Math.min(5 * 60_000, 5_000 * 2 ** Math.max(0, failures - 1));
  return Math.round(base * (0.8 + random() * 0.4));
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
        failures: 0,
        retryAt: undefined,
        errorAt: undefined,
        lastResult: undefined,
        serverStats: undefined,
      });
      return;
    }
    status.set({
      phase: 'syncing',
      server: new URL(config.url).host,
      encrypted: Boolean(config.key),
    });
    try {
      const result = await runSync({
        storage: deps.storage,
        adapter: deps.remote(config.url, config.token),
        key: config.key,
      });
      // Older devices keep writing the retired tables: copy what the pull brought into the new ones.
      if (result.applied > 0) await runAppMigrations(deps.database);
      const at = now();
      await deps.database.table('_meta').put({ key: LAST_SYNC_KEY, value: at });
      status.set({
        phase: 'idle',
        lastSyncAt: at,
        error: undefined,
        errorAt: undefined,
        retryAt: undefined,
        failures: 0,
        rejected: useSyncStatus.getState().rejected + result.rejected,
        lastResult: {
          pulled: result.pulled,
          applied: result.applied,
          pushed: result.pushed,
          rejected: result.rejected,
        },
        pending: await deps.storage.pendingCount(),
      });
    } catch (e) {
      const code = e instanceof SyncError ? e.code : 'unknown';
      if (code === 'unknown') console.error('[sync] failed');
      const at = now();
      const failures = useSyncStatus.getState().failures + 1;
      status.set({
        phase: 'error',
        error: code,
        errorAt: at,
        failures,
        retryAt: RETRYABLE.has(code) ? at + backoffMs(failures) : undefined,
        pending: await deps.storage.pendingCount(),
      });
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
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** `force` ignores a pending backoff (the user came back online or opened the app). */
  const tick = (force = false) => {
    const { retryAt, phase } = useSyncStatus.getState();
    if (!force && retryAt && now() < retryAt) return;
    // Errors the user has to fix (locked device, wrong key) are not retried in the background.
    if (!force && phase === 'error' && !retryAt) return;
    void syncNow(deps).then(() => {
      clearTimeout(retry);
      const next = useSyncStatus.getState().retryAt;
      if (next) retry = setTimeout(() => tick(), Math.max(0, next - now()));
      void runMaintenance(deps);
    });
  };
  const onOnline = () => tick(true);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick(true);
  };

  void restoreSyncStatus(deps).then(() => tick(true));
  const interval = setInterval(() => tick(), INTERVAL_MS);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);

  // Local writes queue records in the outbox; sync soon after they settle.
  const sub = liveQuery(() => deps.storage.pendingCount()).subscribe({
    next(pending) {
      useSyncStatus.getState().set({ pending });
      if (pending > 0 && useSyncStatus.getState().phase !== 'off') {
        clearTimeout(debounce);
        debounce = setTimeout(() => tick(), DEBOUNCE_MS);
      } else if (pending === 0) {
        // Whatever armed the timer was already pushed (e.g. by the sync that follows connecting).
        // A late round for nothing could re-upload data right after another device reset the server.
        clearTimeout(debounce);
      }
    },
    error: () => console.error('[sync] outbox stream failed'),
  });

  return () => {
    clearInterval(interval);
    clearTimeout(debounce);
    clearTimeout(retry);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    sub.unsubscribe();
  };
}

const MAINTENANCE_KEY = 'sync.maintenance.at';
const MAINTENANCE_EVERY_MS = 24 * 3600_000;

/**
 * Once a day (only while sync works): removes synced tombstones older than the retention period
 * and old conflict log entries. Never runs without a successful sync, so nothing is dropped that
 * the server has not received.
 */
export async function runMaintenance(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  try {
    const { phase, lastSyncAt } = useSyncStatus.getState();
    if (phase === 'off' || phase === 'error' || !lastSyncAt) return;
    const meta = deps.database.table<{ key: string; value: number }, string>('_meta');
    const at = now();
    if (at - ((await meta.get(MAINTENANCE_KEY))?.value ?? 0) < MAINTENANCE_EVERY_MS) return;
    await meta.put({ key: MAINTENANCE_KEY, value: at });
    await purgeTombstones(deps.database, syncedTableNames(allManifests), at);
    await purgeConflicts(deps.database, at);
  } catch {
    console.error('[sync] maintenance failed');
  }
}

/* ----------------------------------- connecting ----------------------------------- */

export interface ConnectParams {
  url: string;
  /** The shared server token. A server with devices (protocol 2) swaps it for a per-device token. */
  token: string;
  /** Turn on end-to-end encryption (only possible on an empty server). */
  encrypt: boolean;
  passphrase?: string;
  /** Name shown in the device list of the other devices. */
  deviceName?: string;
}

export type ConnectFailure =
  | 'invalid-url'
  | 'unreachable'
  | 'unauthorized'
  | 'revoked'
  | 'rate-limited'
  | 'passphrase-required'
  | 'passphrase-too-short'
  | 'wrong-passphrase'
  | 'server-has-plain-data'
  /** The server's vault uses the old PBKDF2 scheme; reset the server data to create a v2 vault. */
  | 'vault-outdated'
  | 'server-error';

export type ConnectResult =
  { ok: true; encrypted: boolean } | { ok: false; reason: ConnectFailure };

const failure = (reason: ConnectFailure): ConnectResult => ({ ok: false, reason });

function mapError(e: unknown): ConnectResult {
  if (e instanceof SyncError) {
    if (e.code === 'network') return failure('unreachable');
    if (e.code === 'unauthorized') return failure('unauthorized');
    if (e.code === 'revoked') return failure('revoked');
    if (e.code === 'rate-limited') return failure('rate-limited');
  }
  return failure('server-error');
}

/**
 * Validates the server, sets up or joins the encryption vault (Argon2id, protocol 2), registers this
 * device, stores the configuration and runs the first sync. The server decides whether it is
 * encrypted: a server that already has a vault always needs the passphrase; encryption can only be
 * introduced on an empty server.
 */
export async function connect(
  params: ConnectParams,
  deps: SyncServiceDeps = defaultDeps(),
): Promise<ConnectResult> {
  const url = normalizeServerUrl(params.url);
  if (!url) return failure('invalid-url');
  const sharedToken = params.token.trim();
  if (!sharedToken) return failure('unauthorized');
  const remote = deps.remote(url, sharedToken);

  let key: CryptoKey | undefined;
  let token = sharedToken;
  let deviceId: string | undefined;
  let deviceName: string | undefined;
  try {
    await remote.health();
    let info = await remote.getVault();
    for (let attempt = 0; attempt < 2; attempt++) {
      if (info.vault) {
        if (!params.passphrase) return failure('passphrase-required');
        const kdf = vaultParams(info.vault);
        if (!kdf) return failure('vault-outdated');
        key = await deriveVaultKey(params.passphrase, kdf);
        if (!(await verifyVaultCheck(key, info.vault.check))) return failure('wrong-passphrase');
        break;
      }
      if (!params.encrypt) break;
      if (!params.passphrase || params.passphrase.length < MIN_PASSPHRASE_LENGTH)
        return failure('passphrase-too-short');
      if ((await remote.pull(0, 1)).ops.length > 0) return failure('server-has-plain-data');
      const kdf = newVaultParams(deps.kdf);
      key = await deriveVaultKey(params.passphrase, kdf);
      if (await remote.putVault(toVaultInfo(kdf, await makeVaultCheck(key)))) break;
      // Another device created the vault a moment earlier: join that one instead.
      info = await remote.getVault();
      key = undefined;
    }

    // Protocol 2: the device gets its own token, so it can be locked out without changing the shared
    // one. The shared token is not kept. Older servers keep working with the shared token.
    const server = await remote.info?.();
    if (server?.features.includes('devices') && server.role === 'admin' && remote.registerDevice) {
      const id = (await getDeviceContext(deps.database)).deviceId;
      const name = (params.deviceName ?? '').trim().slice(0, 64) || t.sync.defaultDeviceName;
      let issued = await remote.registerDevice({ id, name });
      // Same device connecting again (e.g. after disconnecting): rotate instead of failing.
      if (issued === 'exists' && remote.rotateDevice)
        issued = (await remote.rotateDevice(id)) ?? issued;
      if (typeof issued === 'object') {
        token = issued.token;
        deviceId = id;
        deviceName = name;
      }
    }
  } catch (e) {
    return mapError(e);
  }

  await saveSyncConfig(deps.database, {
    kind: 'selfHosted',
    url,
    token,
    key,
    ...(deviceId ? { deviceId, deviceName } : {}),
  });
  // Treat the server as new: cursor 0 and a full upload on the first cycle.
  await deps.storage.setEpoch(undefined);
  await deps.storage.setCursor(0);
  useSyncStatus.getState().set({ failures: 0, retryAt: undefined, errorAt: undefined });
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
  useSyncStatus.getState().set({
    phase: 'off',
    server: undefined,
    encrypted: false,
    error: undefined,
    pending: 0,
    failures: 0,
    retryAt: undefined,
    errorAt: undefined,
    lastResult: undefined,
    serverStats: undefined,
  });
}

/* ------------------------------------- devices ------------------------------------- */

async function connectedRemote(deps: SyncServiceDeps) {
  const config = await loadSyncConfig(deps.database);
  return config ? { config, remote: deps.remote(config.url, config.token) } : undefined;
}

/** Devices known to the server; `undefined` when not connected or the server has no device support. */
export async function fetchDevices(
  deps: SyncServiceDeps = defaultDeps(),
): Promise<DeviceInfo[] | undefined> {
  const c = await connectedRemote(deps);
  return c?.remote.listDevices ? c.remote.listDevices() : undefined;
}

/** Locks a device out: its token stops working at once. Its data on the server stays. */
export async function lockDevice(
  id: string,
  deps: SyncServiceDeps = defaultDeps(),
): Promise<boolean> {
  const c = await connectedRemote(deps);
  return c?.remote.revokeDevice ? c.remote.revokeDevice(id) : false;
}

/** Signs this device out: revokes its token on the server (best effort), then disconnects. */
export async function signOutThisDevice(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  const c = await connectedRemote(deps);
  if (c?.config.deviceId && c.remote.revokeDevice) {
    try {
      await c.remote.revokeDevice(c.config.deviceId);
    } catch {
      // offline or already revoked: disconnecting locally is still what the user asked for
    }
  }
  await disconnect(deps);
}

/** Gives this device a new token (the old one stops working). No-op for legacy connections. */
export async function rotateThisDeviceToken(
  deps: SyncServiceDeps = defaultDeps(),
): Promise<boolean> {
  return exclusive(async () => {
    const c = await connectedRemote(deps);
    if (!c?.config.deviceId || !c.remote.rotateDevice) return false;
    const issued = await c.remote.rotateDevice(c.config.deviceId);
    if (!issued) return false;
    await saveSyncConfig(deps.database, { ...c.config, token: issued.token });
    return true;
  });
}

/** Size of the data on the server (also stored in the status for the UI). */
export async function refreshServerStatus(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  try {
    const c = await connectedRemote(deps);
    if (!c?.remote.status) return;
    const s = await c.remote.status();
    useSyncStatus.getState().set({
      serverStats: { records: s.records, fields: s.fields, bytes: s.bytes, devices: s.devices },
    });
  } catch {
    // the size is informational; an unreachable server shows up as a sync error anyway
  }
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
