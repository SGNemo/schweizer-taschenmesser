/**
 * E2E stand-in for the desktop shell's home-network hub (`src-tauri/crates/lan-sync`), which a
 * browser test cannot start. Only wired up in `--mode e2e` builds (see `web.ts`); tests drive the
 * pairing side through `window.__tmLanHub`. Its store is a plain append-only log: it does NOT apply
 * last-write-wins (that rule lives only where `contract/lww-cases.json` pins it); the app merges on
 * pull exactly as it does with the real hub.
 */
import type {
  LanHubDataKey,
  LanHubDevice,
  LanHubPending,
  LanHubService,
  LanHubStatus,
} from './types';

interface Op {
  collection: string;
  id: string;
  field: string;
  hlc: string;
  value: unknown;
}

const toB64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const newKey = (): string => toB64(crypto.getRandomValues(new Uint8Array(32)));
const newEpoch = (): string =>
  [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

export const noLanHub: LanHubService = {
  supported: false,
  start: () => Promise.reject(new Error('unsupported')),
  stop: async () => undefined,
  status: async () => ({
    running: false,
    state: 'off',
    blocked: false,
    pairingOpen: false,
    devices: 0,
  }),
  pairOpen: () => Promise.reject(new Error('unsupported')),
  pairConfirm: () => Promise.reject(new Error('unsupported')),
  pairCancel: async () => undefined,
  devices: async () => [],
  revoke: () => Promise.reject(new Error('unsupported')),
  rotate: () => Promise.reject(new Error('unsupported')),
  request: () => Promise.reject(new Error('unsupported')),
  setHome: () => Promise.reject(new Error('unsupported')),
};

/** E2E specs turn the fake hub on per page (`localStorage['tm-e2e-lanhub'] = '1'`); others see none. */
const E2E_FLAG = 'tm-e2e-lanhub';

export function createFakeLanHub(): LanHubService {
  const { hub: inner, hooks } = createFakeLanHubParts();
  const hub: LanHubService = {
    ...inner,
    get supported() {
      try {
        return localStorage.getItem(E2E_FLAG) === '1';
      } catch {
        return false;
      }
    },
  };
  // Test hooks: a device knocks at the open window (as the real hub reports after the handshake).
  if (typeof window !== 'undefined')
    (window as unknown as { __tmLanHub?: unknown }).__tmLanHub = hooks;
  return hub;
}

/** The fake and its test hooks (unit tests use them directly). */
export function createFakeLanHubParts() {
  let running = false;
  let pairingOpen = false;
  let pending: LanHubPending | null = null;
  let attempt = 0;
  let dataKey: LanHubDataKey = { version: 1, key: newKey() };
  let epoch = newEpoch();
  let log: Op[] = [];
  const devices: LanHubDevice[] = [];

  const active = () => devices.filter((d) => !d.revoked).length;
  const status = (): LanHubStatus => {
    const listening = running && (pairingOpen || active() > 0);
    return {
      running,
      state: listening ? 'listening' : 'off',
      reason: listening ? null : 'nothing-wanted',
      blocked: false,
      port: listening ? 47700 : null,
      pairingOpen,
      qr: listening && pairingOpen ? `NEMO1:fake-${attempt}` : null,
      pending,
      devices: active(),
    };
  };
  const needRunning = () => {
    if (!running) throw new Error('not-started');
  };

  const hub: LanHubService = {
    supported: true,
    start: async () => {
      running = true;
      return { status: status(), dataKey: { ...dataKey } };
    },
    stop: async () => {
      running = false;
      pairingOpen = false;
      pending = null;
    },
    status: async () => status(),
    pairOpen: async () => {
      needRunning();
      if (pairingOpen) throw new Error('busy');
      pairingOpen = true;
      attempt += 1;
    },
    pairConfirm: async (a, code) => {
      needRunning();
      if (!pending || pending.attempt !== a) throw new Error('not-awaiting');
      if (pending.code !== code) throw new Error('wrong-code');
      devices.push({
        id: `dev${devices.length + 1}`.padEnd(64, '0'),
        name: pending.name,
        lastSeen: Math.floor(Date.now() / 1000),
        revoked: false,
      });
      pending = null;
      pairingOpen = false;
    },
    pairCancel: async () => {
      pairingOpen = false;
      pending = null;
    },
    devices: async () => devices.map((d) => ({ ...d })),
    revoke: async (id) => {
      const d = devices.find((x) => x.id === id && !x.revoked);
      if (!d) return false;
      d.revoked = true;
      return true;
    },
    rotate: async () => {
      needRunning();
      dataKey = { version: dataKey.version + 1, key: newKey() };
      epoch = newEpoch();
      log = [];
      return { ...dataKey };
    },
    request: async (body) => {
      needRunning();
      const req = JSON.parse(body) as {
        keyVersion: number;
        type: 'push' | 'pull' | 'info';
        ops?: Op[];
        since?: number;
        limit?: number;
      };
      if (req.keyVersion !== dataKey.version) return JSON.stringify({ error: 'stale-key-version' });
      if (req.type === 'info') return JSON.stringify({ epoch, keyVersion: dataKey.version });
      if (req.type === 'push') {
        const ops = req.ops ?? [];
        if (ops.some((o) => o.value !== null && !String(o.value).startsWith('enc:v1:')))
          return JSON.stringify({ error: 'missing-enc' });
        log.push(...ops);
        return JSON.stringify({ epoch, accepted: ops.length, cursor: log.length });
      }
      const since = req.since ?? 0;
      const limit = req.limit ?? 1000;
      const ops = log.slice(since, since + limit);
      const cursor = since + ops.length;
      return JSON.stringify({ epoch, ops, cursor, more: cursor < log.length });
    },
    setHome: async () => undefined,
  };

  return { hub, hooks: hooks() };

  function hooks() {
    return {
      knock(name: string, code = '482913') {
        if (!pairingOpen) return false;
        pending = { attempt, name, code };
        return true;
      },
      /** Every stored value is ciphertext (what the hub may hold). */
      allEncrypted: () =>
        log.every((o) => o.value === null || String(o.value).startsWith('enc:v1:')),
      opsCount: () => log.length,
    };
  }
}
