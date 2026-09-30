/**
 * In-memory stand-in for the sync server, used by unit tests only (never imported by the app).
 * Implements the same rule as the real server: per field the greatest HLC wins.
 */
import type { RemoteServer } from './service';
import { SyncError, type FieldOp, type PullPage, type SyncAdapter } from './types';

interface Entry extends FieldOp {
  seq: number;
}

export class MemoryServer {
  epoch = 'epoch-1';
  private seq = 0;
  private readonly fields = new Map<string, Entry>();
  vault: { salt: string; check: string } | null = null;
  /** Called at the start of every push (tests use it to modify local data mid-flight). */
  onPush?: () => Promise<void> | void;
  online = true;
  token = 'right-token';
  requests = { push: 0, pull: 0 };

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
      if (token !== this.token) throw new SyncError('unauthorized');
    };
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
        guard();
        this.reset();
      },
    };
  }

  adapter(): SyncAdapter {
    return {
      kind: 'memory',
      push: async (ops) => {
        if (!this.online) throw new SyncError('network');
        this.requests.push++;
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
