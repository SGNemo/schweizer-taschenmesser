/**
 * Settings of the local AI import API: on/off, port, tokens with per-module rights. Device-local
 * (`_meta`, never synced, not in the backup) – tokens belong to this computer. Tokens are shown once
 * and stored only as SHA-256 hash (256 random bits, so no slow hash is needed).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { z } from 'zod';
import { db as defaultDb, type TaschenmesserDB } from '@/core/db/db';
import { rwTransaction } from '@/core/db/tx';
import { now } from '@/core/time/now';

export const DEFAULT_PORT = 47631;
export const MIN_PORT = 1024;
export const MAX_PORT = 65535;
export const TOKEN_PREFIX = 'tm_';
const KEY = 'localApi.config';

const grantSchema = z.object({
  read: z.boolean().default(false),
  write: z.boolean().default(false),
});

const tokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.number(),
  expiresAt: z.number().nullable(),
  grants: z.record(z.string(), grantSchema).default({}),
  autoCommit: z.boolean().default(false),
});

const configSchema = z.object({
  enabled: z.boolean().default(false),
  port: z.number().int().min(MIN_PORT).max(MAX_PORT).default(DEFAULT_PORT),
  tokens: z.array(tokenSchema).default([]),
});

export type Grant = z.output<typeof grantSchema>;
export type ApiToken = z.output<typeof tokenSchema>;
export type LocalApiConfig = z.output<typeof configSchema>;

const DEFAULT_CONFIG: LocalApiConfig = { enabled: false, port: DEFAULT_PORT, tokens: [] };

const meta = (database: TaschenmesserDB) =>
  database.table<{ key: string; value: unknown }, string>('_meta');

export async function loadConfig(database: TaschenmesserDB = defaultDb): Promise<LocalApiConfig> {
  const stored = (await meta(database).get(KEY))?.value;
  const parsed = configSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : { ...DEFAULT_CONFIG };
}

/** Read-modify-write in one transaction, so concurrent changes (revoke vs. anything) never get lost. */
async function mutate(
  database: TaschenmesserDB,
  fn: (config: LocalApiConfig) => LocalApiConfig,
): Promise<LocalApiConfig> {
  return rwTransaction(database, [meta(database)], async () => {
    const clean = configSchema.parse(fn(await loadConfig(database)));
    await meta(database).put({ key: KEY, value: clean });
    return clean;
  });
}

export async function updateConfig(
  patch: Partial<Pick<LocalApiConfig, 'enabled' | 'port'>>,
  database: TaschenmesserDB = defaultDb,
): Promise<LocalApiConfig> {
  return mutate(database, (config) => ({ ...config, ...patch }));
}

export function useLocalApiConfig(): LocalApiConfig | undefined {
  return useLiveQuery(() => loadConfig(), []);
}

export const isExpired = (token: ApiToken, at: number = now()): boolean =>
  token.expiresAt !== null && token.expiresAt <= at;

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface NewToken {
  name: string;
  grants: Record<string, Grant>;
  /** null = never expires. */
  expiresInDays: number | null;
  autoCommit: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** Creates a token; the plain value is returned once and never stored. */
export async function createToken(
  input: NewToken,
  database: TaschenmesserDB = defaultDb,
): Promise<{ token: string; entry: ApiToken }> {
  const token = TOKEN_PREFIX + toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const created = now();
  const entry: ApiToken = {
    id: toBase64Url(crypto.getRandomValues(new Uint8Array(9))),
    name: input.name.trim() || 'KI',
    hash: await hashToken(token),
    createdAt: created,
    expiresAt: input.expiresInDays === null ? null : created + input.expiresInDays * DAY,
    grants: cleanGrants(input.grants),
    autoCommit: input.autoCommit,
  };
  await mutate(database, (config) => ({ ...config, tokens: [...config.tokens, entry] }));
  return { token, entry };
}

const cleanGrants = (grants: Record<string, Grant>): Record<string, Grant> =>
  Object.fromEntries(Object.entries(grants).filter(([, g]) => g.read || g.write));

export async function updateToken(
  id: string,
  patch: Partial<Pick<ApiToken, 'name' | 'grants' | 'autoCommit'>>,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await mutate(database, (config) => ({
    ...config,
    tokens: config.tokens.map((t) =>
      t.id === id ? { ...t, ...patch, grants: cleanGrants(patch.grants ?? t.grants) } : t,
    ),
  }));
}

export async function revokeToken(
  id: string,
  database: TaschenmesserDB = defaultDb,
): Promise<void> {
  await mutate(database, (config) => ({
    ...config,
    tokens: config.tokens.filter((t) => t.id !== id),
  }));
}

/** What the native server needs: hashes and expiry only. */
export const serverTokens = (config: LocalApiConfig) =>
  config.tokens.map((t) => ({ id: t.id, hash: t.hash, expiresAt: t.expiresAt }));
