import { SyncError, type FieldOp, type PullPage, type SyncAdapter } from '../types';

export interface VaultInfo {
  salt: string;
  check: string;
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Talks to the Taschenmesser sync server (`server/`): plain HTTP + bearer token. */
export class SelfHostedAdapter implements SyncAdapter {
  readonly kind = 'selfHosted';
  private readonly base: string;

  constructor(
    url: string,
    private readonly token: string,
    private readonly fetchFn: typeof fetch = (input, init) => fetch(input, init),
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
    if (res.status === 401) throw new SyncError('unauthorized');
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
