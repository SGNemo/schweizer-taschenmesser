import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { createAuth } from './auth.js';
import { ensureVapidKeys, messageFor, type PushSender } from './push.js';
import {
  defaultDeps as defaultProxyDeps,
  proxyFetch,
  ProxyError,
  type ProxyDeps,
} from './proxy.js';
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
  /** Sends Web Push messages. Without one, push routes still work but nothing is delivered. */
  pushSender?: PushSender;
  /** DNS + HTTP used by `/v1/proxy`; tests inject fakes. */
  proxy?: ProxyDeps;
  /** VAPID keys from the environment; otherwise they are generated once and stored. */
  vapid?: { publicKey?: string; privateKey?: string };
}

export const MAX_OPS_PER_PUSH = 5000;
export const MAX_PULL_LIMIT = 5000;
export const MAX_SCHEDULE_ITEMS = 500;
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
    allowedHeaders: ['authorization', 'content-type', 'if-none-match', 'if-modified-since'],
    exposedHeaders: ['etag', 'last-modified'],
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

  const vapid = ensureVapidKeys(store, opts.vapid);
  const subscriptionBody = {
    type: 'object',
    required: ['endpoint', 'keys'],
    additionalProperties: false,
    properties: {
      endpoint: { type: 'string', format: 'uri', pattern: '^https://', maxLength: 1024 },
      keys: {
        type: 'object',
        required: ['p256dh', 'auth'],
        additionalProperties: false,
        properties: {
          p256dh: { type: 'string', minLength: 16, maxLength: 256 },
          auth: { type: 'string', minLength: 8, maxLength: 128 },
        },
      },
    },
  } as const;
  const endpointBody = {
    type: 'object',
    required: ['endpoint'],
    additionalProperties: false,
    properties: { endpoint: { type: 'string', maxLength: 1024 } },
  } as const;

  app.get('/v1/push/key', async () => ({ publicKey: vapid.publicKey }));

  app.put('/v1/push/subscription', { schema: { body: subscriptionBody } }, async (req) => {
    const { endpoint, keys } = req.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    store.upsertSubscription({ endpoint, p256dh: keys.p256dh, auth: keys.auth });
    return { ok: true };
  });

  app.post('/v1/push/unsubscribe', { schema: { body: endpointBody } }, async (req) => {
    store.removeSubscription((req.body as { endpoint: string }).endpoint);
    return { ok: true };
  });

  app.put(
    '/v1/push/schedule',
    {
      schema: {
        body: {
          type: 'object',
          required: ['endpoint', 'items'],
          additionalProperties: false,
          properties: {
            endpoint: { type: 'string', maxLength: 1024 },
            items: {
              type: 'array',
              maxItems: MAX_SCHEDULE_ITEMS,
              items: {
                type: 'object',
                required: ['key', 'at', 'payload'],
                additionalProperties: false,
                properties: {
                  key: { type: 'string', minLength: 1, maxLength: 200 },
                  at: { type: 'integer', minimum: 0 },
                  payload: { type: 'string', minLength: 1, maxLength: 4000 },
                },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const { endpoint, items } = req.body as {
        endpoint: string;
        items: { key: string; at: number; payload: string }[];
      };
      if (!store.getSubscription(endpoint)) {
        return reply.code(404).send({ error: 'unknown-subscription' });
      }
      return { stored: store.replaceSchedule(endpoint, items) };
    },
  );

  // Lets the settings page verify the whole chain (server → push service → browser) right away.
  app.post('/v1/push/test', { schema: { body: endpointBody } }, async (req, reply) => {
    const sub = store.getSubscription((req.body as { endpoint: string }).endpoint);
    if (!sub) return reply.code(404).send({ error: 'unknown-subscription' });
    if (!opts.pushSender) return reply.code(503).send({ error: 'push-disabled' });
    try {
      await opts.pushSender.send(
        sub,
        messageFor({
          key: 'test',
          payload: JSON.stringify({
            title: 'Taschenmesser',
            body: 'Push funktioniert.',
            url: '/settings',
          }),
        }),
      );
      return { sent: true };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) store.removeSubscription(sub.endpoint);
      return reply.code(502).send({ error: 'push-failed', status: status ?? null });
    }
  });

  const PROXY_STATUS: Record<string, number> = {
    'invalid-url': 400,
    blocked: 403,
    'unsupported-type': 415,
    'too-large': 413,
    'too-many-redirects': 502,
    timeout: 504,
    'upstream-error': 502,
  };
  app.get(
    '/v1/proxy',
    {
      // Stricter than the global limit: this route makes the server open outgoing connections.
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        querystring: {
          type: 'object',
          required: ['url'],
          additionalProperties: false,
          properties: { url: { type: 'string', minLength: 8, maxLength: 2048 } },
        },
      },
    },
    async (req, reply) => {
      const { url } = req.query as { url: string };
      try {
        const r = await proxyFetch(
          url,
          {
            ifNoneMatch: req.headers['if-none-match'],
            ifModifiedSince: req.headers['if-modified-since'],
          },
          opts.proxy ?? defaultProxyDeps,
        );
        if (r.etag) reply.header('etag', r.etag);
        if (r.lastModified) reply.header('last-modified', r.lastModified);
        if (r.status === 304) return reply.code(304).send();
        // Never let a fetched page run as HTML/script on our origin.
        reply.header('content-security-policy', "default-src 'none'; sandbox");
        return reply
          .code(200)
          .type(r.contentType ?? 'text/plain')
          .send(r.body);
      } catch (e) {
        const code = e instanceof ProxyError ? e.code : 'upstream-error';
        return reply.code(PROXY_STATUS[code] ?? 502).send({ error: code });
      }
    },
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
