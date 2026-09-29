import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAuth } from './auth.js';
import type { FieldOp, Store } from './store.js';

export interface AppOptions {
  store: Store;
  tokens: readonly string[];
  /** '*' or an allow-list of origins (the PWA is usually same-origin and needs no CORS). */
  corsOrigins?: '*' | string[];
  /** Built PWA (`web/dist`); served with SPA fallback when set. */
  webDir?: string;
  /** Requests per minute and client address. */
  rateLimit?: number;
  logger?: boolean;
}

export const MAX_OPS_PER_PUSH = 5000;
export const MAX_PULL_LIMIT = 5000;
const MAX_VALUE_BYTES = 1_000_000;

const HLC_PATTERN = '^\\d{13}-\\d{4}-[a-z0-9]{1,32}$';

const opSchema = {
  type: 'object',
  required: ['collection', 'id', 'field', 'hlc', 'value'],
  additionalProperties: false,
  properties: {
    collection: { type: 'string', pattern: '^[A-Za-z_][A-Za-z0-9_]{0,63}$' },
    id: { type: 'string', minLength: 1, maxLength: 128 },
    field: { type: 'string', minLength: 1, maxLength: 64 },
    hlc: { type: 'string', pattern: HLC_PATTERN },
    value: {},
  },
} as const;

/** Async because plugins (rate limit!) must be loaded before the routes they protect are added. */
export async function buildApp(opts: AppOptions): Promise<FastifyInstance> {
  const { store } = opts;
  const isAuthorized = createAuth(opts.tokens);
  const app = Fastify({
    logger: opts.logger ?? false,
    bodyLimit: 8 * 1024 * 1024,
    // Reject unknown properties instead of silently stripping them (Fastify's default).
    ajv: { customOptions: { removeAdditional: false } },
  });

  await app.register(cors, {
    origin: opts.corsOrigins ?? '*',
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type'],
    maxAge: 600,
  });
  await app.register(rateLimit, { max: opts.rateLimit ?? 600, timeWindow: '1 minute' });

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/v1/')) return;
    reply.header('cache-control', 'no-store');
    reply.header('x-content-type-options', 'nosniff');
    // CORS preflight carries no credentials; the cors plugin answers it before this hook matters.
    if (req.method === 'OPTIONS' || req.url === '/v1/health') return;
    if (!isAuthorized(req.headers.authorization)) {
      return reply.code(401).header('www-authenticate', 'Bearer').send({ error: 'unauthorized' });
    }
  });

  app.get('/v1/health', async () => ({ ok: true }));

  app.get('/v1/vault', async () => ({ epoch: store.epoch(), vault: store.vault() }));

  app.put(
    '/v1/vault',
    {
      schema: {
        body: {
          type: 'object',
          required: ['salt', 'check'],
          additionalProperties: false,
          properties: {
            salt: { type: 'string', minLength: 8, maxLength: 256 },
            check: { type: 'string', minLength: 8, maxLength: 1024 },
          },
        },
      },
    },
    async (req, reply) => {
      const created = store.setVault(req.body as { salt: string; check: string });
      if (!created) return reply.code(409).send({ error: 'vault-exists', vault: store.vault() });
      return reply.code(201).send({ epoch: store.epoch() });
    },
  );

  app.post(
    '/v1/push',
    {
      schema: {
        body: {
          type: 'object',
          required: ['ops'],
          additionalProperties: false,
          properties: { ops: { type: 'array', maxItems: MAX_OPS_PER_PUSH, items: opSchema } },
        },
      },
    },
    async (req, reply) => {
      const { ops } = req.body as { ops: FieldOp[] };
      if (ops.some((op) => JSON.stringify(op.value ?? null).length > MAX_VALUE_BYTES)) {
        return reply.code(413).send({ error: 'value-too-large' });
      }
      const { accepted, cursor } = store.push(ops);
      return { epoch: store.epoch(), accepted, cursor };
    },
  );

  app.get(
    '/v1/pull',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            since: { type: 'integer', minimum: 0, default: 0 },
            limit: { type: 'integer', minimum: 1, maximum: MAX_PULL_LIMIT, default: 1000 },
          },
        },
      },
    },
    async (req) => {
      const { since = 0, limit = 1000 } = req.query as { since?: number; limit?: number };
      return { epoch: store.epoch(), ...store.pull(since, limit) };
    },
  );

  app.post(
    '/v1/reset',
    {
      schema: {
        body: {
          type: 'object',
          required: ['confirm'],
          additionalProperties: false,
          properties: { confirm: { const: 'RESET' } },
        },
      },
    },
    async () => ({ epoch: store.reset() }),
  );

  if (opts.webDir && existsSync(join(opts.webDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: opts.webDir });
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/v1/')) return reply.sendFile('index.html');
      return reply.code(404).send({ error: 'not-found' });
    });
  }

  return app;
}
