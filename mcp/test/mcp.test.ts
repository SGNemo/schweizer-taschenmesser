import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';
import { createApi } from '../src/api.js';
import { ConfigError, readConfig } from '../src/config.js';
import { createServer } from '../src/server.js';

const TOKEN = 'tm_made-up-test-token-0123456789abcdef';

describe('config', () => {
  it('defaults to the loopback address and needs a token', () => {
    expect(readConfig({ TASCHENMESSER_TOKEN: TOKEN })).toEqual({
      baseUrl: 'http://127.0.0.1:47631',
      token: TOKEN,
    });
    expect(() => readConfig({})).toThrow(ConfigError);
    expect(() => readConfig({ TASCHENMESSER_TOKEN: 'secret' })).toThrow(ConfigError);
  });

  it('never sends the token anywhere but this computer', () => {
    for (const url of [
      'http://example.org:47631',
      'https://127.0.0.1:47631',
      'http://192.168.1.10:47631',
      'http://127.0.0.1.example.org:47631',
      'http://127.0.0.1:47631/v1',
      'http://user:pw@127.0.0.1:47631',
      'not a url',
    ]) {
      expect(() => readConfig({ TASCHENMESSER_TOKEN: TOKEN, TASCHENMESSER_URL: url }), url).toThrow(
        ConfigError,
      );
    }
    expect(
      readConfig({ TASCHENMESSER_TOKEN: TOKEN, TASCHENMESSER_URL: 'http://localhost:50000' })
        .baseUrl,
    ).toBe('http://localhost:50000');
  });

  it('error messages do not contain the token', () => {
    try {
      readConfig({ TASCHENMESSER_TOKEN: TOKEN, TASCHENMESSER_URL: 'http://example.org' });
    } catch (e) {
      expect(String(e)).not.toContain(TOKEN);
    }
  });
});

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(reply: (call: Call) => { status: number; body: unknown }) {
  const calls: Call[] = [];
  const fn = vi.fn(async (input: URL | string, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? 'GET',
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body as string | undefined,
    };
    expect(init?.redirect).toBe('error');
    calls.push(call);
    const r = reply(call);
    return new Response(JSON.stringify(r.body), { status: r.status });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

async function connect(fetchFn: typeof fetch) {
  const api = createApi({ baseUrl: 'http://127.0.0.1:47631', token: TOKEN }, fetchFn);
  const server = createServer(api);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test', version: '1' });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const text = (r: unknown) => (r as { content: { text: string }[] }).content[0]!.text;

describe('tools', () => {
  it('offers the documented tools', async () => {
    const client = await connect(fakeFetch(() => ({ status: 200, body: {} })).fn);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      'commit_batch',
      'get_batch',
      'get_schema',
      'import_items',
      'list_batches',
      'list_modules',
      'read_items',
      'undo_batch',
    ]);
    expect(tools.find((t) => t.name === 'undo_batch')!.annotations?.destructiveHint).toBe(true);
    expect(tools.find((t) => t.name === 'list_modules')!.annotations?.readOnlyHint).toBe(true);
  });

  it('each tool is one call of the local API with the bearer token', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, body: { ok: true } }));
    const client = await connect(fn);
    await client.callTool({ name: 'list_modules', arguments: {} });
    await client.callTool({ name: 'get_schema', arguments: {} });
    await client.callTool({
      name: 'read_items',
      arguments: { module: 'todos', collection: 'task', limit: 10, q: 'Steuer & Co' },
    });
    await client.callTool({ name: 'list_batches', arguments: {} });
    await client.callTool({ name: 'get_batch', arguments: { batchId: 'abc123' } });
    await client.callTool({ name: 'commit_batch', arguments: { batchId: 'abc123' } });
    await client.callTool({ name: 'undo_batch', arguments: { batchId: 'abc123' } });
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'GET http://127.0.0.1:47631/v1/modules',
      'GET http://127.0.0.1:47631/v1/openapi.json',
      'GET http://127.0.0.1:47631/v1/todos/items?collection=task&limit=10&q=Steuer+%26+Co',
      'GET http://127.0.0.1:47631/v1/batches',
      'GET http://127.0.0.1:47631/v1/batches/abc123',
      'POST http://127.0.0.1:47631/v1/batches/abc123/commit',
      'DELETE http://127.0.0.1:47631/v1/batches/abc123',
    ]);
    for (const c of calls) {
      expect(c.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(c.headers).not.toHaveProperty('Origin');
    }
  });

  it('import: dry run without key, real sending with an idempotency key', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 202, body: { status: 'pending' } }));
    const client = await connect(fn);
    const items = [{ collection: 'task', title: 'Winterreifen wechseln' }];
    await client.callTool({
      name: 'import_items',
      arguments: { module: 'todos', items, dryRun: true },
    });
    const res = await client.callTool({
      name: 'import_items',
      arguments: { module: 'todos', items, dryRun: false, idempotencyKey: 'k-1' },
    });
    await client.callTool({
      name: 'import_items',
      arguments: { module: 'todos', items, dryRun: false },
    });
    expect(calls[0]!.url).toBe('http://127.0.0.1:47631/v1/todos/import?dryRun=true');
    expect(calls[0]!.headers).not.toHaveProperty('Idempotency-Key');
    expect(JSON.parse(calls[0]!.body!)).toEqual({ items });
    expect(calls[0]!.headers['Content-Type']).toBe('application/json');
    expect(calls[1]!.url).toBe('http://127.0.0.1:47631/v1/todos/import');
    expect(calls[1]!.headers['Idempotency-Key']).toBe('k-1');
    expect(calls[2]!.headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(text(res)).toContain('pending');
  });

  it('rejects arguments that would change the path', async () => {
    const { fn, calls } = fakeFetch(() => ({ status: 200, body: {} }));
    const client = await connect(fn);
    for (const args of [
      { name: 'read_items', arguments: { module: '../_secrets' } },
      { name: 'read_items', arguments: { module: 'todos/../x' } },
      { name: 'get_batch', arguments: { batchId: '../modules' } },
      { name: 'undo_batch', arguments: { batchId: 'a?b=1' } },
    ]) {
      const res = await client.callTool(args);
      expect(res.isError, JSON.stringify(args)).toBe(true);
    }
    expect(calls).toEqual([]);
  });

  it('reports API errors and an unreachable app as tool errors', async () => {
    const client = await connect(
      fakeFetch(() => ({ status: 403, body: { error: 'forbidden', message: 'Recht fehlt' } })).fn,
    );
    const denied = await client.callTool({ name: 'list_modules', arguments: {} });
    expect(denied.isError).toBe(true);
    expect(text(denied)).toContain('HTTP 403');

    const down = await connect((async () => {
      throw new TypeError('fetch failed');
    }) as unknown as typeof fetch);
    const res = await down.callTool({ name: 'list_modules', arguments: {} });
    expect(res.isError).toBe(true);
    expect(text(res)).toContain('nicht erreichbar');
    expect(text(res)).not.toContain(TOKEN);
  });
});
