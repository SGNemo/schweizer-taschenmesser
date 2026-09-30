import { getPlatform } from '@/core/platform';
import {
  SyncError,
  type DeviceInfo,
  type FieldOp,
  type PullPage,
  type ServerInfo,
  type ServerStatus,
  type SyncAdapter,
} from '../types';

export interface VaultInfo {
  salt: string;
  check: string;
  /** 2 = Argon2id with `kdf`. Vaults without it are the legacy PBKDF2 kind and are not supported. */
  v?: 2;
  kdf?: { alg: 'argon2id'; m: number; t: number; p: number };
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Talks to the Taschenmesser sync server (`server/`): plain HTTP + bearer token. */
export class SelfHostedAdapter implements SyncAdapter {
  readonly kind = 'selfHosted';
  private readonly base: string;

  constructor(
    url: string,
    private readonly token: string,
    private readonly fetchFn: typeof fetch = (input, init) => getPlatform().fetch(input, init),
  ) {
    this.base = normalizeServerUrl(url) ?? url;
  }

  private async request(
    path: string,
    init: RequestInit = {},
    okStatuses: number[] = [],
  ): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base}${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${this.token}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      // Offline, server down, blocked by CORS or mixed content: the browser does not tell which.
      throw new SyncError('network');
    }
    if (res.status === 401) {
      const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
      throw new SyncError(body?.error === 'revoked' ? 'revoked' : 'unauthorized');
    }
    if (res.status === 429) throw new SyncError('rate-limited');
    if (!res.ok && !okStatuses.includes(res.status))
      throw new SyncError('server', `HTTP ${res.status}`);
    return res;
  }

  async health(): Promise<void> {
    let res: Response;
    try {
      res = await this.fetchFn(`${this.base}/v1/health`, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new SyncError('network');
    }
    if (!res.ok) throw new SyncError('server', `HTTP ${res.status}`);
  }

  async push(ops: FieldOp[]): Promise<{ epoch: string }> {
    const res = await this.request('/v1/push', { method: 'POST', body: JSON.stringify({ ops }) });
    return { epoch: ((await res.json()) as { epoch: string }).epoch };
  }

  async pull(since: number, limit: number): Promise<PullPage> {
    const res = await this.request(`/v1/pull?since=${since}&limit=${limit}`);
    return (await res.json()) as PullPage;
  }

  async getVault(): Promise<{ epoch: string; vault: VaultInfo | null }> {
    const res = await this.request('/v1/vault');
    return (await res.json()) as { epoch: string; vault: VaultInfo | null };
  }

  /** `false` when another device created the vault first (its vault is then authoritative). */
  async putVault(vault: VaultInfo): Promise<boolean> {
    const res = await this.request(
      '/v1/vault',
      { method: 'PUT', body: JSON.stringify(vault) },
      [409],
    );
    return res.status !== 409;
  }

  /** Protocol level and features; `undefined` for a server that predates protocol 2. */
  async info(): Promise<ServerInfo | undefined> {
    const res = await this.request('/v1/info', {}, [404]);
    return res.status === 404 ? undefined : ((await res.json()) as ServerInfo);
  }

  /** Registers this device (needs the shared token). `exists`: the id is taken, rotate instead. */
  async registerDevice(device: {
    id: string;
    name: string;
  }): Promise<{ token: string } | 'exists' | 'forbidden'> {
    const res = await this.request(
      '/v1/devices',
      { method: 'POST', body: JSON.stringify(device) },
      [403, 409],
    );
    if (res.status === 409) return 'exists';
    if (res.status === 403) return 'forbidden';
    return { token: ((await res.json()) as { token: string }).token };
  }

  /** New token for a device; the old one stops working. `undefined`: unknown or revoked device. */
  async rotateDevice(id: string): Promise<{ token: string } | undefined> {
    const res = await this.request(
      `/v1/devices/${encodeURIComponent(id)}/rotate`,
      { method: 'POST' },
      [404],
    );
    return res.status === 404
      ? undefined
      : { token: ((await res.json()) as { token: string }).token };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const res = await this.request('/v1/devices');
    return ((await res.json()) as { devices: DeviceInfo[] }).devices;
  }

  /** Locks a device out. `false` when the server does not know it. */
  async revokeDevice(id: string): Promise<boolean> {
    const res = await this.request(
      `/v1/devices/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
      [404],
    );
    return res.status !== 404;
  }

  async status(): Promise<ServerStatus> {
    return (await (await this.request('/v1/status')).json()) as ServerStatus;
  }

  /** Deletes all data on the server (and its vault). */
  async reset(): Promise<void> {
    await this.request('/v1/reset', { method: 'POST', body: JSON.stringify({ confirm: 'RESET' }) });
  }
}

/** "https://host:8787/" → "https://host:8787"; undefined for anything that is not http(s). */
export function normalizeServerUrl(input: string): string | undefined {
  try {
    const u = new URL(input.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return undefined;
  }
}
