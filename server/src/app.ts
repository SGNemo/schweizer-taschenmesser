import { existsSync } from 'node:fs';
import { join } from 'node:path';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import {
  createAuthenticator,
  createFailureLimiter,
  hashToken,
  newDeviceToken,
  type AuthResult,
} from './auth.js';
import { ensureVapidKeys, messageFor, type PushSender } from './push.js';
import {
  defaultDeps as defaultProxyDeps,
  proxyFetch,
  ProxyError,
  type ProxyDeps,
} from './proxy.js';
import type { FieldOp, Store, Vault } from './store.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Who the bearer token belongs to (set for every authenticated `/v1/` request). */
    auth?: AuthResult;
  }
}

/** Protocol level of this server. 2 adds devices, `/v1/info`, `/v1/status` and Argon2id vaults. */
export const PROTOCOL_VERSION = 2;
export const FEATURES = ['devices', 'stats', 'vault-v2'] as const;

/** Feed URLs may carry private tokens: never write the query of `/v1/proxy` to the log. */
export const redactUrl = (url: string): string =>
  url.startsWith('/v1/proxy?') ? '/v1/proxy?url=[redacted]' : url;

const DEVICE_ID_PATTERN = '^[a-z0-9]{1,32}$';
const TOUCH_INTERVAL_MS = 60_000;

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
  /** Trust `X-Forwarded-For` (set only behind your own reverse proxy), so limits count real clients. */
  trustProxy?: boolean;
  /** Failed logins per client address and minute before it is blocked (default 20). */
  authFailureLimit?: number;
  /** Clock override for tests. */
  clock?: () => number;
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
  const clock = opts.clock ?? Date.now;
  const authenticate = createAuthenticator(opts.tokens, (h) => {
    const d = store.deviceByTokenHash(h);
    return d && { id: d.id, revoked: d.revoked };
  });
  const failures = createFailureLimiter(opts.authFailureLimit ?? 20, 60_000, clock);
  const lastTouch = new Map<string, number>();
  const app = Fastify({
    logger: opts.logger
      ? {
          serializers: {
            req: (req: FastifyRequest) => ({
              method: req.method,
              url: redactUrl(req.url),
              host: req.host,
              remoteAddress: req.ip,
            }),
          },
        }
      : false,
    trustProxy: opts.trustProxy ?? false,
    bodyLimit: 8 * 1024 * 1024,
    // Reject unknown properties instead of silently stripping them (Fastify's default).
    ajv: { customOptions: { removeAdditional: false } },
  });

  await app.register(cors, {
    origin: opts.corsOrigins ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
    const wait = failures.blockedFor(req.ip);
    if (wait > 0) {
      return reply.code(429).header('retry-after', wait).send({ error: 'too-many-failures' });
    }
    const who = authenticate(req.headers.authorization);
    if (!who) {
      failures.fail(req.ip);
      return reply.code(401).header('www-authenticate', 'Bearer').send({ error: 'unauthorized' });
    }
    if (who.role === 'revoked') {
      return reply.code(401).header('www-authenticate', 'Bearer').send({ error: 'revoked' });
    }
    req.auth = who;
    if (who.role === 'device') {
      const at = clock();
      if (at - (lastTouch.get(who.deviceId) ?? 0) >= TOUCH_INTERVAL_MS) {
        lastTouch.set(who.deviceId, at);
        store.touchDevice(who.deviceId, at, 'seen');
      }
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
            v: { const: 2 },
            kdf: {
              type: 'object',
              required: ['alg', 'm', 't', 'p'],
              additionalProperties: false,
              properties: {
                alg: { const: 'argon2id' },
                m: { type: 'integer', minimum: 8, maximum: 1_048_576 },
                t: { type: 'integer', minimum: 1, maximum: 32 },
                p: { type: 'integer', minimum: 1, maximum: 16 },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const body = req.body as Vault;
      // A v2 vault needs its KDF parameters and the other way round.
      if ((body.v === 2) !== Boolean(body.kdf)) return reply.code(400).send({ error: 'bad-vault' });
      const created = store.setVault(body);
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
      if (req.auth?.role === 'device') store.touchDevice(req.auth.deviceId, clock(), 'push');
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
      if (req.auth?.role === 'device') store.touchDevice(req.auth.deviceId, clock(), 'pull');
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
    async (req, reply) => {
      // Wiping the data set is an admin action; a device token (possibly stolen) must not do it.
      if (req.auth?.role !== 'admin') return reply.code(403).send({ error: 'forbidden' });
      return { epoch: store.reset() };
    },
  );

  /* ---- Protocol info, size and devices (protocol 2) ---- */
  app.get('/v1/info', async (req) => ({
    protocol: PROTOCOL_VERSION,
    features: FEATURES,
    role: req.auth?.role ?? 'admin',
    deviceId: req.auth?.role === 'device' ? req.auth.deviceId : null,
  }));

  app.get('/v1/status', async () => ({
    epoch: store.epoch(),
    ...store.stats(),
    devices: store.listDevices().filter((d) => d.revokedAt === null).length,
  }));

  const deviceView = (d: ReturnType<Store['listDevices']>[number], current?: string) => ({
    ...d,
    current: d.id === current,
  });

  app.get('/v1/devices', async (req) => ({
    devices: store
      .listDevices()
      .map((d) => deviceView(d, req.auth?.role === 'device' ? req.auth.deviceId : undefined)),
  }));

  app.post(
    '/v1/devices',
    {
      schema: {
        body: {
          type: 'object',
          required: ['id', 'name'],
          additionalProperties: false,
          properties: {
            id: { type: 'string', pattern: DEVICE_ID_PATTERN },
            name: { type: 'string', minLength: 1, maxLength: 64 },
          },
        },
      },
    },
    async (req, reply) => {
      // Only the shared (admin) token registers devices; the device then works with its own token.
      if (req.auth?.role !== 'admin') return reply.code(403).send({ error: 'forbidden' });
      const { id, name } = req.body as { id: string; name: string };
      const token = newDeviceToken();
      if (!store.createDevice({ id, name, tokenHash: hashToken(token), at: clock() })) {
        return reply.code(409).send({ error: 'device-exists' });
      }
      return reply.code(201).send({ id, name, token });
    },
  );

  const idParams = {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', pattern: DEVICE_ID_PATTERN } },
  } as const;

  // Token rotation: admin for any device, a device for itself. The old token stops working at once.
  app.post('/v1/devices/:id/rotate', { schema: { params: idParams } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const own = req.auth?.role === 'device' && req.auth.deviceId === id;
    if (req.auth?.role !== 'admin' && !own) return reply.code(403).send({ error: 'forbidden' });
    const token = newDeviceToken();
    if (!store.rotateDeviceToken(id, hashToken(token))) {
      return reply.code(404).send({ error: 'unknown-device' });
    }
    return { id, token };
  });

  // Locks a device out. Any authenticated device may do it, so a lost phone can be locked from the
  // laptop; devices cannot create devices or reset the server.
  app.delete('/v1/devices/:id', { schema: { params: idParams } }, async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!store.revokeDevice(id, clock())) return reply.code(404).send({ error: 'unknown-device' });
    return { ok: true };
  });

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
            title: 'Nemo',
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
