import { z } from 'zod';
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

/* ----------------------------- response schemas ----------------------------- */
/*
 * Every server answer is validated before it is used: a malformed page (non-string id, non-number
 * cursor) would otherwise poison the cursor or throw in the middle of a merge for good.
 */

const epochSchema = z.string().min(1).max(64);

const fieldOpSchema = z.object({
  collection: z
    .string()
    .max(128)
    .regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  id: z.string().min(1).max(128),
  field: z.string().min(1).max(64),
  hlc: z.string().regex(/^\d{13}-\d{4}-[a-z0-9]{1,32}$/),
  value: z.unknown(),
});

export const pullPageSchema = z.object({
  epoch: epochSchema,
  ops: z.array(fieldOpSchema),
  cursor: z.number().int().nonnegative(),
  more: z.boolean(),
});

const epochOnlySchema = z.object({ epoch: epochSchema });

const vaultInfoSchema = z.object({
  salt: z.string().min(1).max(256),
  check: z.string().min(1).max(1024),
  v: z.literal(2).optional(),
  kdf: z
    .object({
      alg: z.literal('argon2id'),
      m: z.number().int().positive(),
      t: z.number().int().positive(),
      p: z.number().int().positive(),
    })
    .optional(),
});

const vaultResponseSchema = z.object({ epoch: epochSchema, vault: vaultInfoSchema.nullable() });

const serverInfoSchema = z.object({
  protocol: z.number().int().nonnegative(),
  features: z.array(z.string().max(64)).max(64),
  role: z.enum(['admin', 'device']),
  deviceId: z.string().max(64).nullable(),
});

const tokenSchema = z.object({ token: z.string().min(1).max(256) });

const deviceInfoSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(128),
  createdAt: z.number(),
  lastSeenAt: z.number().nullable(),
  lastPushAt: z.number().nullable(),
  lastPullAt: z.number().nullable(),
  revokedAt: z.number().nullable(),
  current: z.boolean(),
});

const devicesSchema = z.object({ devices: z.array(deviceInfoSchema).max(1000) });

const serverStatusSchema = z.object({
  epoch: epochSchema,
  fields: z.number().int().nonnegative(),
  records: z.number().int().nonnegative(),
  bytes: z.number().int().nonnegative(),
  devices: z.number().int().nonnegative(),
});

/** Parses the JSON body against `schema`; anything else is a broken or foreign server. */
async function parseBody<T>(res: Response, schema: z.ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new SyncError('server', 'malformed response');
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new SyncError('server', 'unexpected response shape');
  return parsed.data;
}

/** Talks to the Nemo sync server (`server/`): plain HTTP + bearer token. */
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
    if (res.status === 400) {
      const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined;
      if (body?.error === 'hlc-drift') throw new SyncError('clock');
    }
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
    return { epoch: (await parseBody(res, epochOnlySchema)).epoch };
  }

  async pull(since: number, limit: number): Promise<PullPage> {
    const res = await this.request(`/v1/pull?since=${since}&limit=${limit}`);
    return parseBody(res, pullPageSchema);
  }

  async getVault(): Promise<{ epoch: string; vault: VaultInfo | null }> {
    const res = await this.request('/v1/vault');
    return parseBody(res, vaultResponseSchema);
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
    return res.status === 404 ? undefined : parseBody(res, serverInfoSchema);
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
    return { token: (await parseBody(res, tokenSchema)).token };
  }

  /** New token for a device; the old one stops working. `undefined`: unknown or revoked device. */
  async rotateDevice(id: string): Promise<{ token: string } | undefined> {
    const res = await this.request(
      `/v1/devices/${encodeURIComponent(id)}/rotate`,
      { method: 'POST' },
      [404],
    );
    return res.status === 404 ? undefined : { token: (await parseBody(res, tokenSchema)).token };
  }

  async listDevices(): Promise<DeviceInfo[]> {
    const res = await this.request('/v1/devices');
    return (await parseBody(res, devicesSchema)).devices;
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
    return parseBody(await this.request('/v1/status'), serverStatusSchema);
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
