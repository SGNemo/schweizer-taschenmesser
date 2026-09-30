/**
 * In-memory stand-in for the sync server, used by unit tests only (never imported by the app).
 * Implements the same rule as the real server: per field the greatest HLC wins.
 */
import type { RemoteServer } from './service';
import { SyncError, type DeviceInfo, type FieldOp, type PullPage, type SyncAdapter } from './types';

interface Entry extends FieldOp {
  seq: number;
}

export class MemoryServer {
  epoch = 'epoch-1';
  private seq = 0;
  private readonly fields = new Map<string, Entry>();
  vault: import('./adapters/selfHosted').VaultInfo | null = null;
  /** Protocol 2: per-device tokens, `info`, `status`. Off = behaves like a legacy server. */
  supportsDevices = false;
  private readonly devices = new Map<string, DeviceInfo & { token: string }>();
  private tokenCounter = 0;
  /** Called at the start of every push (tests use it to modify local data mid-flight). */
  onPush?: () => Promise<void> | void;
  online = true;
  token = 'right-token';
  requests = { push: 0, pull: 0 };
  /** Throws a network error on the n-th push / pull from now on (1-based, counted per call), once. */
  failPushAt?: number;
  failPullAt?: number;
  /** Largest number of ops seen in one push request. */
  maxPushOps = 0;

  private key(op: FieldOp): string {
    return `${op.collection}\u0000${op.id}\u0000${op.field}`;
  }

  reset(): void {
    this.fields.clear();
    this.vault = null;
    this.seq = 0;
    this.epoch = `epoch-${Number(this.epoch.split('-')[1]) + 1}`;
  }

  /** What the server stores, for assertions. */
  dump(): FieldOp[] {
    return [...this.fields.values()].map(({ seq: _seq, ...op }) => op);
  }

  /** The full server API (health, vault, reset) with token check, as the service expects it. */
  remote(token = 'right-token'): RemoteServer {
    const base = this.adapter();
    const guard = () => {
      if (!this.online) throw new SyncError('network');
      if (token === this.token) return 'admin';
      const device = [...this.devices.values()].find((d) => d.token === token);
      if (!device) throw new SyncError('unauthorized');
      if (device.revokedAt !== null) throw new SyncError('revoked');
      device.lastSeenAt = Date.now();
      return device.id;
    };
    const devices = this.supportsDevices;
    return {
      kind: 'memory',
      push: async (ops) => (guard(), base.push(ops)),
      pull: async (since, limit) => (guard(), base.pull(since, limit)),
      health: async () => {
        if (!this.online) throw new SyncError('network');
      },
      getVault: async () => {
        guard();
        return { epoch: this.epoch, vault: this.vault };
      },
      putVault: async (vault) => {
        guard();
        if (this.vault) return false;
        this.vault = vault;
        return true;
      },
      reset: async () => {
        if (guard() !== 'admin') throw new SyncError('unauthorized');
        this.reset();
      },
      ...(devices
        ? {
            info: async () => {
              const who = guard();
              return {
                protocol: 2,
                features: ['devices', 'stats', 'vault-v2'],
                role: who === 'admin' ? ('admin' as const) : ('device' as const),
                deviceId: who === 'admin' ? null : who,
              };
            },
            registerDevice: async (d: { id: string; name: string }) => {
              if (guard() !== 'admin') return 'forbidden' as const;
              if (this.devices.has(d.id)) return 'exists' as const;
              const issued = `device-token-${++this.tokenCounter}-xxxxxxxxxxxxxxxx`;
              this.devices.set(d.id, {
                id: d.id,
                name: d.name,
                createdAt: Date.now(),
                lastSeenAt: null,
                lastPushAt: null,
                lastPullAt: null,
                revokedAt: null,
                current: false,
                token: issued,
              });
              return { token: issued };
            },
            rotateDevice: async (id: string) => {
              guard();
              const d = this.devices.get(id);
              if (!d || d.revokedAt !== null) return undefined;
              d.token = `device-token-${++this.tokenCounter}-xxxxxxxxxxxxxxxx`;
              return { token: d.token };
            },
            listDevices: async () => {
              const who = guard();
              return [...this.devices.values()].map(({ token: _t, ...d }) => ({
                ...d,
                current: d.id === who,
              }));
            },
            revokeDevice: async (id: string) => {
              guard();
              const d = this.devices.get(id);
              if (!d) return false;
              d.revokedAt ??= Date.now();
              return true;
            },
            status: async () => ({
              epoch: this.epoch,
              fields: this.fields.size,
              records: new Set([...this.fields.values()].map((f) => `${f.collection}${f.id}`)).size,
              bytes: JSON.stringify([...this.fields.values()]).length,
              devices: [...this.devices.values()].filter((d) => d.revokedAt === null).length,
            }),
          }
        : {}),
    };
  }

  adapter(): SyncAdapter {
    return {
      kind: 'memory',
      push: async (ops) => {
        if (!this.online) throw new SyncError('network');
        this.requests.push++;
        this.maxPushOps = Math.max(this.maxPushOps, ops.length);
        if (this.failPushAt === this.requests.push) {
          this.failPushAt = undefined;
          throw new SyncError('network');
        }
        await this.onPush?.();
        for (const op of ops) {
          const cur = this.fields.get(this.key(op));
          if (!cur || op.hlc > cur.hlc) this.fields.set(this.key(op), { ...op, seq: ++this.seq });
        }
        return { epoch: this.epoch };
      },
      pull: async (since, limit): Promise<PullPage> => {
        if (!this.online) throw new SyncError('network');
        this.requests.pull++;
        if (this.failPullAt === this.requests.pull) {
          this.failPullAt = undefined;
          throw new SyncError('network');
        }
        const rows = [...this.fields.values()]
          .filter((e) => e.seq > since)
          .sort((a, b) => a.seq - b.seq);
        const page = rows.slice(0, limit);
        return {
          epoch: this.epoch,
          ops: page.map(({ seq: _seq, ...op }) => op),
          cursor: page.length ? page[page.length - 1]!.seq : since,
          more: rows.length > limit,
        };
      },
    };
  }
}
