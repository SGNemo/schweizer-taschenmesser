import type { FastifyInstance } from 'fastify';
import { buildApp, type AppOptions } from '../src/app.js';
import { openStore, type FieldOp, type Store } from '../src/store.js';

export const TOKEN = 'test-token-0123456789abcdef';
export const auth = { authorization: `Bearer ${TOKEN}` };

export async function setup(
  overrides: Partial<AppOptions> = {},
): Promise<{ app: FastifyInstance; store: Store }> {
  const store = openStore(':memory:');
  const app = await buildApp({ store, tokens: [TOKEN], ...overrides });
  return { app, store };
}

export const hlc = (wall: number, counter = 0, device = 'aaaa0001'): string =>
  `${String(wall).padStart(13, '0')}-${String(counter).padStart(4, '0')}-${device}`;

export const op = (
  field: string,
  stamp: string,
  value: unknown,
  id = 'r1',
  collection = 'todos_task',
): FieldOp => ({ collection, id, field, hlc: stamp, value });

export async function push(app: FastifyInstance, ops: FieldOp[]) {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/push',
    headers: auth,
    payload: { ops },
  });
  return {
    status: res.statusCode,
    body: res.json() as { accepted: number; cursor: number; epoch: string },
  };
}

export async function pull(app: FastifyInstance, since = 0, limit = 1000) {
  const res = await app.inject({
    method: 'GET',
    url: `/v1/pull?since=${since}&limit=${limit}`,
    headers: auth,
  });
  return {
    status: res.statusCode,
    body: res.json() as { ops: FieldOp[]; cursor: number; more: boolean; epoch: string },
  };
}
