import { t } from '@/strings';
import { liveQuery } from 'dexie';
import { runAppMigrations } from '@/core/db/appMigrations';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { DexieStorageAdapter, PULL_COMPLETE_KEY } from '@/core/storage/dexie';
import type { StorageAdapter } from '@/core/storage/types';
import { now } from '@/core/time/now';
import { getDeviceContext } from '@/core/db/device';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import { SelfHostedAdapter, normalizeServerUrl, type VaultInfo } from './adapters/selfHosted';
import { LanClientAdapter, LanHubAdapter } from './adapters/lanHub';
import { copyTodoLinksAfterSync } from '@/core/entitylinks/migrate';
import { getPlatform } from '@/core/platform';
import { SYNC_TOKEN_SECRET } from './names';
import type {
  LanClientService,
  LanWatchService,
  LanHubDataKey,
  LanHubService,
  LanPairing,
} from '@/core/platform/types';
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
export type SyncConfig = ServerSyncConfig | LanHubSyncConfig | LanClientSyncConfig;

/** Sync through an own server (`server/`). */
export interface ServerSyncConfig {
  kind: 'selfHosted';
  url: string;
  /**
   * The server token. In the apps the stored record holds `''` and the token lives in the OS keystore
   * (`sync.token`, S5): read it only through `loadSyncConfig`, never from `_secrets.syncConfig`. The
   * record keeps the token itself only when the keystore refused it or this start's keystore probe
   * failed; the next healthy start moves it.
   */
  token: string;
  /** Non-extractable AES-GCM key when end-to-end encryption is on. */
  key?: CryptoKey;
  /** Set when the server knows this device (protocol 2): `token` is then its own, revocable token. */
  deviceId?: string;
  deviceName?: string;
}

/**
 * This PC is the home-network hub (`src-tauri/crates/lan-sync`) and syncs with it in process. The
 * data key comes from the hub (OS keystore) on every start; here it is only the non-extractable
 * `CryptoKey` imported from it, plus its version, which every request carries.
 */
export interface LanHubSyncConfig {
  kind: 'lanHub';
  key: CryptoKey;
  keyVersion: number;
}

/**
 * This device (phone) is paired with a hub PC. The device key and the pinned hub live in the OS
 * keystore on the Rust side (`lan_client.rs`); here only the data key (non-extractable) and its
 * version, received once when the pairing was confirmed on the PC.
 */
export interface LanClientSyncConfig {
  kind: 'lanClient';
  key: CryptoKey;
  keyVersion: number;
  /** The pinned hub (hex public key): every request names it, so no round reaches another PC. */
  hub: string;
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
  /** The home-network hub of the desktop shell (absent or unsupported elsewhere). */
  lanHub?: () => LanHubService;
  /** The device side of home-network sync (Android). */
  lanClient?: () => LanClientService;
  /** Wi-Fi available/lost (Android): a phone paired with a PC syncs when it comes home. */
  lanWatch?: () => LanWatchService;
}

export function defaultDeps(): SyncServiceDeps {
  return {
    database: defaultDb,
    storage: new DexieStorageAdapter(defaultDb),
    remote: (url, token) => new SelfHostedAdapter(url, token),
    lanHub: () => getPlatform().lanHub,
    lanClient: () => getPlatform().lanClient,
    lanWatch: () => getPlatform().lanWatch,
  };
}

const CONFIG_KEY = 'syncConfig';
/** `_meta` key of the last successful round's time; written after every round (consumers re-read the gate on it). */
export const LAST_SYNC_KEY = 'sync.lastSyncAt';
export const MIN_PASSPHRASE_LENGTH = 12;

/* ------------------------------ config persistence ------------------------------ */

const tokenInKeystore = (): boolean => getPlatform().secrets.protection === 'os-keystore';

/**
 * Save, clear and the S5 move of the server token run one at a time, so a move that started from an
 * old record can never write back a token that `connect`, a rotation or `disconnect` replaced. Not
 * re-entrant: never call a lock-taking function (load '' branch, save, clear, move) from inside.
 */
let tokenChain: Promise<unknown> = Promise.resolve();
function withTokenLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = tokenChain.then(fn, fn);
  tokenChain = next.catch(() => undefined);
  return next;
}

async function readRecord(database: TaschenmesserDB): Promise<SyncConfig | undefined> {
  return (
    await database.table<{ key: string; value: SyncConfig }, string>('_secrets').get(CONFIG_KEY)
  )?.value;
}

/** Whether a sync connection exists – the stored record only, no key store involved. */
export async function hasSyncConfig(database: TaschenmesserDB = defaultDb): Promise<boolean> {
  return (await readRecord(database)) !== undefined;
}

/** The kind of the stored connection – the record only, no key store involved. */
export async function syncConfigKind(
  database: TaschenmesserDB = defaultDb,
): Promise<SyncConfig['kind'] | undefined> {
  return (await readRecord(database))?.kind;
}

/**
 * The full connection, with the server token. In the apps the token comes from the OS keystore, so
 * this never runs inside a Dexie transaction, and callers that only need to know whether (or which)
 * connection exists use `hasSyncConfig` / `syncConfigKind`. A token the store cannot give is `''`:
 * the next sync round then reports `token-missing` instead of sending an empty token.
 */
export async function loadSyncConfig(
  database: TaschenmesserDB = defaultDb,
): Promise<SyncConfig | undefined> {
  const config = await readRecord(database);
  if (config?.kind !== 'selfHosted') return config;
  if (config.token) {
    if (tokenInKeystore()) await moveToken(database, config.token);
    return config;
  }
  // Record and token are read together under the lock, so a save in between cannot pair the old
  // record with a new token. Whatever the store is on this start (a failed probe falls back to the
  // device-key store), it is asked.
  return withTokenLock(async () => {
    const now = await readRecord(database);
    if (now?.kind !== 'selfHosted' || now.token) return now;
    const token = await getPlatform()
      .secrets.get(SYNC_TOKEN_SECRET)
      .catch(() => undefined);
    return { ...now, token: token ?? '' };
  });
}

/**
 * A record from before S5: read the old place, write the new one, then delete the old – only while
 * the record still holds that token. A refusing keystore leaves the record as it is (sync keeps
 * working; the next start tries again).
 */
function moveToken(database: TaschenmesserDB, token: string): Promise<void> {
  return withTokenLock(async () => {
    const now = await readRecord(database);
    if (now?.kind !== 'selfHosted' || now.token !== token) return;
    try {
      await getPlatform().secrets.set(SYNC_TOKEN_SECRET, token);
    } catch {
      return;
    }
    await database.table('_secrets').put({ key: CONFIG_KEY, value: { ...now, token: '' } });
  });
}

/**
 * The own-server settings only: push, the feed proxy and the device list need a server. Without a
 * readable token they get none (no request with an empty token); the sync status says `token-missing`.
 */
export async function loadServerConfig(
  database: TaschenmesserDB = defaultDb,
): Promise<ServerSyncConfig | undefined> {
  const config = await loadSyncConfig(database);
  return config?.kind === 'selfHosted' && config.token ? config : undefined;
}

function saveSyncConfig(database: TaschenmesserDB, config: SyncConfig): Promise<void> {
  return withTokenLock(async () => {
    if (config.kind === 'selfHosted' && tokenInKeystore()) {
      // The keystore first: the record without a token is only written once the token is safe.
      // If the keystore refuses, the token stays in the record (as before S5) rather than being lost.
      const stored = await getPlatform()
        .secrets.set(SYNC_TOKEN_SECRET, config.token)
        .then(() => true)
        .catch(() => false);
      await database
        .table('_secrets')
        .put({ key: CONFIG_KEY, value: stored ? { ...config, token: '' } : config });
      return;
    }
    const before = await readRecord(database);
    await database.table('_secrets').put({ key: CONFIG_KEY, value: config });
    // The token of a server connection this one replaces is not needed any more.
    if (before?.kind === 'selfHosted' && config.kind !== 'selfHosted')
      await getPlatform()
        .secrets.delete(SYNC_TOKEN_SECRET)
        .catch(() => undefined);
  });
}

/** Tests only: the server → home-network replace is otherwise reachable only through a race in `enableLanHub`. */
export const saveSyncConfigForTests = (database: TaschenmesserDB, config: SyncConfig) =>
  saveSyncConfig(database, config);

function clearSyncConfig(database: TaschenmesserDB): Promise<void> {
  return withTokenLock(async () => {
    await database.table('_secrets').delete(CONFIG_KEY);
    // A failure here leaves a dead token in the keystore until the next connect or "Alle Daten löschen".
    await getPlatform()
      .secrets.delete(SYNC_TOKEN_SECRET)
      .catch(() => undefined);
    // The flag describes the connection that is gone now.
    await database.table('_meta').delete(PULL_COMPLETE_KEY);
  });
}

/* ------------------------------------ syncing ------------------------------------ */

let chain: Promise<unknown> = Promise.resolve();
/** Rounds queued or running in this tab's chain (`syncSettled`). */
let inFlight = 0;

/** One sync at a time: in this tab via a promise chain, across tabs via the Web Locks API. */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = async () =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('taschenmesser-sync', fn)
      : fn();
  inFlight++;
  const next = chain.then(run, run).finally(() => {
    inFlight--;
  });
  chain = next.catch(() => undefined);
  return next;
}

/**
 * Is this device's view of the synced data settled enough to act on another device's fields? True
 * without a sync configuration. With one: only while this tab's sync chain is idle and the last pull
 * ended complete (`more: false`, recorded by `pullAll` in `_meta`); with `wait` a round still running
 * is awaited first – a paged or failed pull can split
 * the field ops of one record (a ToDo's `plannedFor` and `planMark`) across pages. The planner gates
 * its copies and overwrites of a user's date on this; it never touches `navigator.locks` itself.
 */
export async function syncSettled(
  database: TaschenmesserDB = defaultDb,
  opts: { wait?: boolean } = {},
): Promise<boolean> {
  if (!(await hasSyncConfig(database))) return true;
  // `wait`: a background caller woken by the round's own `_meta` write lets this tab's chain end first
  // (bounded by the queued rounds); a user action reads the gate as it is.
  if (opts.wait) await chain;
  if (inFlight > 0) return false;
  const row = await database
    .table<{ key: string; value: unknown }, string>('_meta')
    .get(PULL_COMPLETE_KEY);
  return row?.value === true;
}

function statusLabel(config: SyncConfig): {
  server: string | undefined;
  via: 'server' | 'lanHub' | 'lanClient';
  encrypted: boolean;
} {
  return config.kind === 'selfHosted'
    ? { server: new URL(config.url).host, via: 'server', encrypted: Boolean(config.key) }
    : { server: undefined, via: config.kind, encrypted: true };
}

/**
 * The transport of one round. For the hub PC the hub is (re)started first – idempotent, and it hands
 * out the current data key: if the key was renewed meanwhile, the new one is imported and the next
 * pull sees the new epoch, so everything is uploaded again under the new key.
 */
async function adapterFor(
  config: SyncConfig,
  deps: SyncServiceDeps,
): Promise<{ adapter: SyncAdapter; key: CryptoKey | undefined }> {
  if (config.kind === 'selfHosted') {
    // The key store had no token (another PC, a reset Windows profile): say so instead of sending none.
    if (!config.token) throw new SyncError('token-missing');
    return { adapter: deps.remote(config.url, config.token), key: config.key };
  }
  if (config.kind === 'lanClient') {
    const client = deps.lanClient?.();
    if (!client?.supported) throw new SyncError('unsupported');
    const hub = config.hub;
    const transport = { request: (body: string) => client.request(body, hub) };
    return { adapter: new LanClientAdapter(transport, config.keyVersion), key: config.key };
  }
  const hub = deps.lanHub?.();
  if (!hub?.supported) throw new SyncError('unsupported');
  let started: { dataKey: LanHubDataKey };
  try {
    started = await hub.start();
  } catch {
    throw new SyncError('network');
  }
  let current = config;
  if (started.dataKey.version !== config.keyVersion) {
    current = await adoptLanHubKey(deps, started.dataKey);
  }
  return { adapter: new LanHubAdapter(hub, current.keyVersion), key: current.key };
}

/** Imports the hub's data key as a non-extractable AES-GCM key. */
async function importDataKey(dataKey: LanHubDataKey): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(dataKey.key), (c) => c.charCodeAt(0));
  if (raw.length !== 32) throw new SyncError('no-key');
  try {
    return await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
      'encrypt',
      'decrypt',
    ]);
  } finally {
    raw.fill(0);
  }
}

/** Stores the hub PC's own connection with its current data key. */
async function adoptLanHubKey(
  deps: SyncServiceDeps,
  dataKey: LanHubDataKey,
): Promise<LanHubSyncConfig> {
  const config: LanHubSyncConfig = {
    kind: 'lanHub',
    key: await importDataKey(dataKey),
    keyVersion: dataKey.version,
  };
  await saveSyncConfig(deps.database, config);
  return config;
}

/** Errors that can heal by themselves; everything else needs the user (token, passphrase, lock). */
// `token-missing` too: a locked or briefly unavailable key store heals by itself (no request is sent).
const RETRYABLE = new Set(['network', 'server', 'rate-limited', 'unknown', 'token-missing']);

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
        via: undefined,
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
    status.set({ phase: 'syncing', ...statusLabel(config) });
    try {
      const { adapter, key } = await adapterFor(config, deps);
      const result = await runSync({ storage: deps.storage, adapter, key });
      // Older devices keep writing the retired tables: copy what the pull brought into the new ones.
      if (result.applied > 0) await runAppMigrations(deps.database);
      // …and they keep writing links into the ToDo's own field: those become link rows here – after the
      // pull completed, so a removal made elsewhere is already on this device (first copy included).
      await copyTodoLinksAfterSync(deps.database, result.applied > 0 || result.pushed > 0);
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
      // A missing token heals only where the OS keystore answers; on a start without it, it cannot.
      const retry = RETRYABLE.has(code) && (code !== 'token-missing' || tokenInKeystore());
      status.set({
        phase: 'error',
        error: code,
        errorAt: at,
        failures,
        retryAt: retry ? at + backoffMs(failures) : undefined,
        pending: await deps.storage.pendingCount(),
      });
    }
  });
}

/** Loads persisted status after a reload so the UI is not blank until the first sync finishes. */
export async function restoreSyncStatus(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  // Labels only (host, kind, encryption): the record is enough, no key store read.
  const config = await readRecord(deps.database);
  const last = (
    await deps.database.table<{ key: string; value: number }, string>('_meta').get(LAST_SYNC_KEY)
  )?.value;
  useSyncStatus.getState().set(
    config
      ? {
          phase: 'idle',
          ...statusLabel(config),
          lastSyncAt: last,
          pending: await deps.storage.pendingCount(),
        }
      : {
          phase: 'off',
          server: undefined,
          via: undefined,
          encrypted: false,
          lastSyncAt: undefined,
        },
  );
}

const INTERVAL_MS = 60_000;
const DEBOUNCE_MS = 1500;

/**
 * A round (or the first restore of the status) that meets a closed or deleted database, for example after a
 * reset, has nobody left to report to: `syncNow` writes its errors to the status store, and that needs the
 * database too. Anything else is logged without details.
 */
function ignoreClosedDatabase(e: unknown): void {
  if (e instanceof Error && e.name === 'DatabaseClosedError') return;
  console.error('[sync] round failed');
}

/**
 * Keeps the device in sync: on start, every minute, when coming back online or visible, and
 * shortly after local changes; a phone paired with a PC also when Wi-Fi comes up (it came home).
 * Returns a function that stops everything.
 */
export function startSync(deps: SyncServiceDeps = defaultDeps()): () => void {
  let debounce: ReturnType<typeof setTimeout> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  /** Set by the returned stop function: a restore or a round that finishes later starts nothing new. */
  let stopped = false;
  /** `force` ignores a pending backoff (the user came back online or opened the app). */
  const tick = (force = false) => {
    if (stopped) return;
    const { retryAt, phase } = useSyncStatus.getState();
    if (!force && retryAt && now() < retryAt) return;
    // Errors the user has to fix (locked device, wrong key) are not retried in the background.
    if (!force && phase === 'error' && !retryAt) return;
    void syncNow(deps)
      .then(() => {
        if (stopped) return;
        clearTimeout(retry);
        const next = useSyncStatus.getState().retryAt;
        if (next) retry = setTimeout(() => tick(), Math.max(0, next - now()));
        void runMaintenance(deps);
      })
      .catch(ignoreClosedDatabase);
  };
  const onOnline = () => tick(true);
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick(true);
  };

  void restoreSyncStatus(deps)
    .then(() => tick(true))
    .catch(ignoreClosedDatabase);
  const interval = setInterval(() => tick(), INTERVAL_MS);
  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  const stopWifi = watchWifi(deps, () => stopped, tick);

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
    stopped = true;
    clearInterval(interval);
    clearTimeout(debounce);
    clearTimeout(retry);
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    stopWifi();
    sub.unsubscribe();
  };
}

/**
 * Android: keeps `wifi` in the status store and, when Wi-Fi comes up on a phone paired with a PC
 * (`lanClient`), starts a round at once (CONCEPT §6). Only the platform knows how; this names no
 * command. Elsewhere nothing is watched and `wifi` stays unset.
 */
function watchWifi(
  deps: SyncServiceDeps,
  stopped: () => boolean,
  tick: (force?: boolean) => void,
): () => void {
  const watch = deps.lanWatch?.();
  if (!watch?.supported) return () => undefined;
  const status = useSyncStatus.getState();
  void watch
    .wifi()
    .then((wifi) => {
      if (!stopped()) status.set({ wifi });
    })
    .catch(() => undefined);
  return watch.onWifiChange((connected) => {
    if (stopped()) return;
    status.set({ wifi: connected });
    if (!connected) return;
    void syncConfigKind(deps.database)
      .then((kind) => {
        if (kind === 'lanClient') tick(true);
      })
      .catch(ignoreClosedDatabase);
  });
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
    via: undefined,
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

/* -------------------------------- home-network hub -------------------------------- */

export type LanHubFailure =
  'unsupported' | 'server-connected' | 'client-paired' | 'keystore' | 'failed';
export type LanHubResult = { ok: true } | { ok: false; reason: LanHubFailure };

/**
 * Turns this PC into the home-network hub: starts the hub, imports its data key and runs the first
 * round (everything local is uploaded into the hub's store, encrypted). One path per device: a
 * device connected to an own server disconnects from it first, and a PC paired with another hub PC
 * never becomes a hub itself (refused here and again in Rust).
 */
export async function enableLanHub(deps: SyncServiceDeps = defaultDeps()): Promise<LanHubResult> {
  const hub = deps.lanHub?.();
  if (!hub?.supported) return { ok: false, reason: 'unsupported' };
  const existing = await syncConfigKind(deps.database);
  if (existing === 'selfHosted') return { ok: false, reason: 'server-connected' };
  if (existing === 'lanClient') return { ok: false, reason: 'client-paired' };
  let dataKey: LanHubDataKey;
  try {
    dataKey = (await hub.start()).dataKey;
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    if (code === 'client-paired') return { ok: false, reason: 'client-paired' };
    return { ok: false, reason: code === 'keystore-unavailable' ? 'keystore' : 'failed' };
  }
  await exclusive(async () => {
    await adoptLanHubKey(deps, dataKey);
    if (!existing) {
      // A new hub store: cursor 0 and a full upload on the first round.
      await deps.storage.setEpoch(undefined);
      await deps.storage.setCursor(0);
    }
  });
  useSyncStatus.getState().set({ failures: 0, retryAt: undefined, errorAt: undefined });
  await syncNow(deps);
  return { ok: true };
}

/** Stops the hub and this PC's syncing with it. Local data, paired devices and keys stay. */
export async function disableLanHub(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  await deps
    .lanHub?.()
    .stop()
    .catch(() => undefined);
  await disconnect(deps);
}

/**
 * "Schlüssel erneuern": the hub empties its store under a new key version; this PC imports the new
 * key and uploads everything again. Paired devices pair again (they never get the new key otherwise).
 */
export async function renewLanHubKey(deps: SyncServiceDeps = defaultDeps()): Promise<boolean> {
  const hub = deps.lanHub?.();
  if (!hub?.supported) return false;
  const done = await exclusive(async () => {
    const config = await loadSyncConfig(deps.database);
    if (config?.kind !== 'lanHub') return false;
    try {
      await adoptLanHubKey(deps, await hub.rotate());
    } catch {
      return false;
    }
    await deps.storage.setEpoch(undefined);
    await deps.storage.setCursor(0);
    return true;
  });
  if (done) await syncNow(deps);
  return done;
}

/* ------------------------------ device paired with a PC ------------------------------ */

export type PairFailure =
  | 'unsupported'
  | 'other-path'
  | 'hub-on'
  | 'bad-qr'
  | 'network'
  | 'pairing-not-possible'
  | 'pairing-aborted'
  | 'cancelled'
  | 'busy'
  | 'keystore'
  | 'failed';
export type PairResult = { ok: true } | { ok: false; reason: PairFailure };

const PAIR_FAILURES: readonly PairFailure[] = [
  'bad-qr',
  'network',
  'pairing-not-possible',
  'pairing-aborted',
  'cancelled',
  'busy',
  'hub-on',
];

/**
 * "Mit PC koppeln": pairs this device with the hub PC of `qr` (the PC asks the user to compare the
 * code that `onCode` receives), imports the data key and runs the first round. One path per device:
 * refused while an own server is connected, and on a PC while it is the hub itself (`hub-on`, also
 * checked in Rust): a second PC pairs as a client only.
 */
export async function pairWithPc(
  qr: string,
  name: string,
  onCode: (code: string) => void,
  deps: SyncServiceDeps = defaultDeps(),
): Promise<PairResult> {
  const client = deps.lanClient?.();
  if (!client?.supported) return { ok: false, reason: 'unsupported' };
  const existing = await syncConfigKind(deps.database);
  if (existing === 'lanHub') return { ok: false, reason: 'hub-on' };
  if (existing && existing !== 'lanClient') return { ok: false, reason: 'other-path' };
  let dataKey: LanPairing;
  try {
    dataKey = await client.pair(qr.trim(), name, onCode);
  } catch (e) {
    const code = e instanceof Error ? e.message : '';
    if (code === 'keystore-unavailable') return { ok: false, reason: 'keystore' };
    const known = PAIR_FAILURES.find((f) => f === code);
    return { ok: false, reason: known ?? 'failed' };
  }
  // The PC trusts this device now. Anything that fails from here on would leave the PC with a paired
  // device the phone does not know: undo the pairing on the PC (best effort) and say so.
  let stored: boolean;
  try {
    const key = await importDataKey(dataKey);
    stored = await exclusive(async () => {
      // still one path per device: an own server connected while the PC was asking wins
      const now = await syncConfigKind(deps.database);
      if (now && now !== 'lanClient') return false;
      await saveSyncConfig(deps.database, {
        kind: 'lanClient',
        key,
        keyVersion: dataKey.version,
        hub: dataKey.hub,
      });
      // a new hub store: cursor 0, everything local goes up once
      await deps.storage.setEpoch(undefined);
      await deps.storage.setCursor(0);
      return true;
    });
  } catch {
    stored = false;
  }
  if (!stored) {
    await client.unpair().catch(() => undefined);
    // Rust already replaced the previous pairing; an old lanClient config would point at nothing
    if (existing === 'lanClient') await disconnect(deps).catch(() => undefined);
    return { ok: false, reason: 'failed' };
  }
  useSyncStatus.getState().set({ failures: 0, retryAt: undefined, errorAt: undefined });
  // the dialog closes now; the first round shows its progress in the status line
  void syncNow(deps);
  return { ok: true };
}

/** Stops waiting for the confirmation on the PC. */
export async function cancelPairing(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  await deps
    .lanClient?.()
    .cancelPair()
    .catch(() => undefined);
}

/** "Kopplung lösen" on this device: tells the PC when reachable, forgets the keys; data stays. */
export async function unpairFromPc(deps: SyncServiceDeps = defaultDeps()): Promise<void> {
  await deps
    .lanClient?.()
    .unpair()
    .catch(() => undefined);
  await disconnect(deps);
}

/* ------------------------------------- devices ------------------------------------- */

async function connectedRemote(deps: SyncServiceDeps) {
  const config = await loadServerConfig(deps.database);
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

/**
 * Signs this device out: revokes its token on the server (best effort), then disconnects. With a
 * device token that cannot be read right now (key store locked), nothing happens and the answer is
 * `token-missing`: disconnecting alone would leave the token valid on the server.
 */
export async function signOutThisDevice(
  deps: SyncServiceDeps = defaultDeps(),
): Promise<'ok' | 'token-missing'> {
  // One read: the device id and the token come from the same record.
  const config = await loadSyncConfig(deps.database);
  if (config?.kind === 'selfHosted' && config.deviceId && !config.token) return 'token-missing';
  const remote = config?.kind === 'selfHosted' ? deps.remote(config.url, config.token) : undefined;
  if (config?.kind === 'selfHosted' && config.deviceId && remote?.revokeDevice) {
    try {
      await remote.revokeDevice(config.deviceId);
    } catch {
      // offline or already revoked: disconnecting locally is still what the user asked for
    }
  }
  await disconnect(deps);
  return 'ok';
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
