import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  checkUrl,
  defaultDeps,
  isBlockedAddress,
  KIND_RULES,
  MAX_PROXY_BYTES,
  proxyFetch,
  ProxyError,
  type ProxyDeps,
  type UpstreamResponse,
} from '../src/proxy.js';
import { auth, setup } from './helpers.js';

const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';
const ok = (over: Partial<UpstreamResponse> = {}): UpstreamResponse => ({
  status: 200,
  headers: { 'content-type': 'text/calendar; charset=utf-8', etag: '"v1"' },
  body: Buffer.from(ICS),
  ...over,
});

function fakeDeps(
  routes: Record<string, string[] | UpstreamResponse | ((address: string) => UpstreamResponse)>,
) {
  const fetched: { url: string; address: string; headers: Record<string, string> }[] = [];
  const deps: ProxyDeps = {
    async resolve(host) {
      const r = routes[host];
      if (Array.isArray(r)) return r;
      return ['93.184.216.34'];
    },
    async fetch({ url, address, headers }) {
      fetched.push({ url: url.toString(), address, headers });
      const r = routes[`fetch:${url.hostname}${url.pathname}`] ?? routes[url.hostname];
      if (r && !Array.isArray(r)) return typeof r === 'function' ? r(address) : r;
      return ok();
    },
  };
  return { deps, fetched };
}

describe('isBlockedAddress', () => {
  it.each([
    '127.0.0.1',
    '127.9.9.9',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '198.18.0.1',
    '192.0.2.5',
    '::',
    '::1',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    'ff02::1',
    '2001:db8::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    '::ffff:7f00:1',
    '::ffff:a9fe:a9fe',
    '64:ff9b::a9fe:a9fe',
    '2002:c0a8:0101::1',
    'not-an-ip',
    '',
  ])('blocks %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(true);
  });

  it.each([
    '93.184.216.34',
    '8.8.8.8',
    '172.32.0.1',
    '100.63.255.255',
    '2606:2800:220:1:248:1893:25c8:1946',
    '2a00:1450:4001:81b::200e',
    '::ffff:8.8.8.8',
  ])('allows %s', (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe('checkUrl', () => {
  it('accepts plain http(s) URLs on the usual ports', () => {
    expect(checkUrl('https://cal.example.test/x.ics').hostname).toBe('cal.example.test');
    expect(checkUrl('http://cal.example.test:8080/x.ics').port).toBe('8080');
  });
  it.each([
    'ftp://x.example.test/a',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'gopher://x',
    'https://user:pw@x.example.test/',
    'https://x.example.test:22/',
    'http://x.example.test:6379/',
    'no url',
  ])('rejects %s', (u) => {
    expect(() => checkUrl(u)).toThrow(ProxyError);
  });
});

describe('proxyFetch', () => {
  it('returns the body with type and validators, connecting to the checked address', async () => {
    const { deps, fetched } = fakeDeps({ 'cal.example.test': ['93.184.216.34'] });
    const r = await proxyFetch('https://cal.example.test/x.ics', {}, deps);
    expect(r).toMatchObject({ status: 200, etag: '"v1"' });
    expect(r.body.toString()).toBe(ICS);
    expect(fetched[0]).toMatchObject({ address: '93.184.216.34' });
  });

  it('forwards conditional headers and passes a 304 through', async () => {
    const { deps, fetched } = fakeDeps({
      'cal.example.test': { status: 304, headers: { etag: '"v1"' }, body: Buffer.alloc(0) },
    });
    const r = await proxyFetch(
      'https://cal.example.test/x.ics',
      { ifNoneMatch: '"v1"', ifModifiedSince: 'Mon, 01 Jan 2026 00:00:00 GMT' },
      deps,
    );
    expect(r.status).toBe(304);
    expect(fetched[0]!.headers['if-none-match']).toBe('"v1"');
    expect(fetched[0]!.headers['if-modified-since']).toContain('2026');
  });

  it('refuses a host that resolves to a private address, even when another answer is public', async () => {
    const { deps, fetched } = fakeDeps({ 'evil.example.test': ['93.184.216.34', '10.0.0.5'] });
    await expect(proxyFetch('https://evil.example.test/x.ics', {}, deps)).rejects.toMatchObject({
      code: 'blocked',
    });
    expect(fetched).toEqual([]);
  });

  it('refuses IP-literal targets: loopback, metadata, IPv6', async () => {
    const { deps, fetched } = fakeDeps({});
    for (const u of [
      'http://127.0.0.1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://[::1]/',
      'http://[::ffff:127.0.0.1]/',
      'http://2130706433/',
      'http://0x7f000001/',
    ])
      await expect(proxyFetch(u, {}, deps), u).rejects.toMatchObject({ code: 'blocked' });
    expect(fetched).toEqual([]);
  });

  it('checks every redirect hop again', async () => {
    const { deps, fetched } = fakeDeps({
      'a.example.test': {
        status: 302,
        headers: { location: 'https://b.example.test/x.ics' },
        body: Buffer.alloc(0),
      },
      'b.example.test': ['192.168.0.10'],
    });
    await expect(proxyFetch('https://a.example.test/x.ics', {}, deps)).rejects.toMatchObject({
      code: 'blocked',
    });
    expect(fetched).toHaveLength(1); // the first hop only
  });

  it('follows a relative redirect to a public host and stops after three hops', async () => {
    const good = fakeDeps({
      'a.example.test': { status: 301, headers: { location: '/moved.ics' }, body: Buffer.alloc(0) },
      'fetch:a.example.test/moved.ics': ok(),
    });
    expect((await proxyFetch('https://a.example.test/x.ics', {}, good.deps)).status).toBe(200);

    const loop = fakeDeps({
      'a.example.test': {
        status: 302,
        headers: { location: 'https://a.example.test/again' },
        body: Buffer.alloc(0),
      },
    });
    await expect(proxyFetch('https://a.example.test/x', {}, loop.deps)).rejects.toMatchObject({
      code: 'too-many-redirects',
    });
    expect(loop.fetched).toHaveLength(4);
  });

  it('refuses redirects to other schemes or ports', async () => {
    const { deps } = fakeDeps({
      'a.example.test': {
        status: 302,
        headers: { location: 'file:///etc/passwd' },
        body: Buffer.alloc(0),
      },
    });
    await expect(proxyFetch('https://a.example.test/x', {}, deps)).rejects.toMatchObject({
      code: 'invalid-url',
    });
  });

  it('only returns feed-like content types', async () => {
    for (const type of [
      'text/html',
      'application/javascript',
      'image/png',
      'application/json',
      '',
    ]) {
      const { deps } = fakeDeps({ 'a.example.test': ok({ headers: { 'content-type': type } }) });
      await expect(proxyFetch('https://a.example.test/x', {}, deps), type).rejects.toMatchObject({
        code: 'unsupported-type',
      });
    }
    for (const type of [
      'application/rss+xml; charset=utf-8',
      'application/atom+xml',
      'text/xml',
      'application/xml',
      'text/calendar',
      'text/plain',
    ]) {
      const { deps } = fakeDeps({ 'a.example.test': ok({ headers: { 'content-type': type } }) });
      expect((await proxyFetch('https://a.example.test/x', {}, deps)).status).toBe(200);
    }
  });

  describe('kind=page and kind=image (link preview, reader text)', () => {
    const html = (over: Partial<UpstreamResponse> = {}) =>
      ok({
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: Buffer.from('<p>x</p>'),
        ...over,
      });

    it('returns HTML only when asked for a page, and keeps refusing it by default', async () => {
      const { deps } = fakeDeps({ 'a.example.test': html() });
      await expect(proxyFetch('https://a.example.test/x', {}, deps)).rejects.toMatchObject({
        code: 'unsupported-type',
      });
      await expect(proxyFetch('https://a.example.test/x', {}, deps, 'image')).rejects.toMatchObject(
        { code: 'unsupported-type' },
      );
      expect((await proxyFetch('https://a.example.test/x', {}, deps, 'page')).status).toBe(200);
    });

    it('a page request never returns feed types, scripts or images', async () => {
      for (const type of [
        'text/calendar',
        'application/javascript',
        'image/png',
        'image/svg+xml',
      ]) {
        const { deps } = fakeDeps({ 'a.example.test': ok({ headers: { 'content-type': type } }) });
        await expect(
          proxyFetch('https://a.example.test/x', {}, deps, 'page'),
          type,
        ).rejects.toMatchObject({ code: 'unsupported-type' });
      }
    });

    it('images: raster types only, never SVG', async () => {
      for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) {
        const { deps } = fakeDeps({ 'a.example.test': ok({ headers: { 'content-type': type } }) });
        expect((await proxyFetch('https://a.example.test/i', {}, deps, 'image')).status).toBe(200);
      }
      for (const type of ['image/svg+xml', 'image/x-icon', 'text/html']) {
        const { deps } = fakeDeps({ 'a.example.test': ok({ headers: { 'content-type': type } }) });
        await expect(
          proxyFetch('https://a.example.test/i', {}, deps, 'image'),
          type,
        ).rejects.toMatchObject({ code: 'unsupported-type' });
      }
    });

    it('applies the per-kind size limit and asks upstream for that limit', async () => {
      expect(KIND_RULES.page.maxBytes).toBe(1024 * 1024);
      expect(KIND_RULES.image.maxBytes).toBe(512 * 1024);
      const big = fakeDeps({
        'a.example.test': html({ body: Buffer.alloc(KIND_RULES.page.maxBytes + 1) }),
      });
      await expect(
        proxyFetch('https://a.example.test/x', {}, big.deps, 'page'),
      ).rejects.toMatchObject({
        code: 'too-large',
      });
      // a page may be larger than an image is allowed to be
      const img = fakeDeps({
        'a.example.test': ok({
          headers: { 'content-type': 'image/png' },
          body: Buffer.alloc(KIND_RULES.image.maxBytes + 1),
        }),
      });
      await expect(
        proxyFetch('https://a.example.test/i', {}, img.deps, 'image'),
      ).rejects.toMatchObject({
        code: 'too-large',
      });
    });

    it('keeps every address rule: blocked hosts and redirects are checked for all kinds', async () => {
      const { deps } = fakeDeps({ 'evil.example.test': ['10.0.0.5'] });
      for (const kind of ['feed', 'page', 'image'] as const)
        await expect(
          proxyFetch('https://evil.example.test/x', {}, deps, kind),
        ).rejects.toMatchObject({ code: 'blocked' });
      const redirect = fakeDeps({
        'a.example.test': {
          status: 302,
          headers: { location: 'http://127.0.0.1/' },
          body: Buffer.alloc(0),
        },
      });
      await expect(
        proxyFetch('https://a.example.test/x', {}, redirect.deps, 'page'),
      ).rejects.toMatchObject({ code: 'blocked' });
    });

    it('a blocked address never reaches the fetcher: not as the first hop, not as a redirect target', async () => {
      const spy = fakeDeps({
        'evil.example.test': ['10.0.0.5'],
        'mixed.example.test': ['93.184.216.34', '169.254.169.254'],
        'hop.example.test': {
          status: 302,
          headers: { location: 'https://evil.example.test/x' },
          body: Buffer.alloc(0),
        },
      });
      for (const kind of ['feed', 'page', 'image'] as const) {
        for (const target of [
          'https://evil.example.test/x',
          'https://mixed.example.test/x',
          'http://127.0.0.1/x',
          'http://[::1]/x',
          'https://hop.example.test/x',
        ]) {
          await expect(
            proxyFetch(target, {}, spy.deps, kind),
            `${kind} ${target}`,
          ).rejects.toMatchObject({
            code: 'blocked',
          });
        }
      }
      // only the harmless first hop of the redirect chain was ever fetched, never a blocked address
      expect(spy.fetched.every((f) => f.url.startsWith('https://hop.example.test/'))).toBe(true);
      expect(spy.fetched.some((f) => /^(10\.|127\.|169\.254\.|::1)/.test(f.address))).toBe(false);
    });

    it('sends a matching Accept header', async () => {
      const { deps, fetched } = fakeDeps({ 'a.example.test': html() });
      await proxyFetch('https://a.example.test/x', {}, deps, 'page');
      expect(fetched[0]!.headers.accept).toContain('text/html');
    });
  });

  it('maps upstream failures and unresolvable hosts', async () => {
    const down = fakeDeps({ 'a.example.test': ok({ status: 503 }) });
    await expect(proxyFetch('https://a.example.test/x', {}, down.deps)).rejects.toMatchObject({
      code: 'upstream-error',
    });
    const none = fakeDeps({ 'a.example.test': [] });
    await expect(proxyFetch('https://a.example.test/x', {}, none.deps)).rejects.toMatchObject({
      code: 'upstream-error',
    });
  });
});

describe('the real fetcher (against a local server, address given directly)', () => {
  let server: http.Server | undefined;
  afterEach(() => new Promise<void>((done) => (server ? server.close(() => done()) : done())));

  async function serve(handler: http.RequestListener) {
    server = http.createServer(handler);
    await new Promise<void>((r) => server!.listen(0, '127.0.0.1', r));
    return (server.address() as AddressInfo).port;
  }
  const call = (port: number, over: { timeoutMs?: number; maxBytes?: number } = {}) =>
    defaultDeps.fetch({
      url: new URL(`http://feed.example.test:${port}/x.ics`),
      address: '127.0.0.1', // the "pinned" address: the host name is never looked up
      headers: { host: `feed.example.test:${port}`, accept: '*/*' },
      timeoutMs: over.timeoutMs ?? 2000,
      maxBytes: over.maxBytes ?? MAX_PROXY_BYTES,
    });

  it('connects to the pinned address, keeps the Host header and returns status, headers, body', async () => {
    let seenHost: string | undefined;
    const port = await serve((req, res) => {
      seenHost = req.headers.host;
      res.writeHead(200, { 'content-type': 'text/calendar', etag: '"abc"' });
      res.end(ICS);
    });
    const r = await call(port);
    expect(seenHost).toBe(`feed.example.test:${port}`);
    expect(r.status).toBe(200);
    expect(r.headers.etag).toBe('"abc"');
    expect(r.body.toString()).toBe(ICS);
  });

  it('sends the path and query of the address it was given, to the pinned address and port', async () => {
    let seenUrl: string | undefined;
    const port = await serve((req, res) => {
      seenUrl = req.url;
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
    });
    const r = await defaultDeps.fetch({
      url: new URL(`http://feed.example.test:${port}/a/b%20c.ics?x=1&y=%C3%A4`),
      address: '127.0.0.1',
      headers: { host: `feed.example.test:${port}` },
      timeoutMs: 2000,
      maxBytes: MAX_PROXY_BYTES,
    });
    expect(r.status).toBe(200);
    expect(seenUrl).toBe('/a/b%20c.ics?x=1&y=%C3%A4');
  });

  it('stops reading at the size limit', async () => {
    const port = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end(Buffer.alloc(5000, 65));
    });
    await expect(call(port, { maxBytes: 1000 })).rejects.toMatchObject({ code: 'too-large' });
  });

  it('gives up on a server that never answers', async () => {
    const port = await serve(() => {
      /* no response */
    });
    await expect(call(port, { timeoutMs: 150 })).rejects.toMatchObject({ code: 'timeout' });
  });

  it('gives up on a server that keeps trickling bytes (total deadline, not only inactivity)', async () => {
    let timer: NodeJS.Timeout | undefined;
    const port = await serve((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/plain' });
      timer = setInterval(() => res.write('x'), 20);
      res.on('close', () => clearInterval(timer));
    });
    const started = Date.now();
    await expect(call(port, { timeoutMs: 200 })).rejects.toMatchObject({ code: 'timeout' });
    expect(Date.now() - started).toBeLessThan(2000);
    clearInterval(timer);
  });

  it('reports a refused connection as an upstream error', async () => {
    const port = await serve((_q, res) => res.end());
    await new Promise<void>((r) => server!.close(() => r()));
    server = undefined;
    await expect(call(port)).rejects.toMatchObject({ code: 'upstream-error' });
  });

  it('never talks to loopback through the public entry point', async () => {
    const port = await serve((_q, res) => res.end(ICS));
    await expect(proxyFetch(`http://127.0.0.1:${port}/x.ics`, {})).rejects.toMatchObject({
      code: 'invalid-url',
    }); // odd port
    await expect(proxyFetch('http://127.0.0.1/x.ics', {})).rejects.toMatchObject({
      code: 'blocked',
    });
  });
});

describe('GET /v1/proxy', () => {
  it('needs the token', async () => {
    const { app } = await setup({ proxy: fakeDeps({}).deps });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/proxy?url=https://cal.example.test/x.ics',
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns the feed with its validators and a locked-down CSP', async () => {
    const { app } = await setup({ proxy: fakeDeps({}).deps });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/proxy?url=https%3A%2F%2Fcal.example.test%2Fx.ics',
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(ICS);
    expect(res.headers['content-type']).toContain('text/calendar');
    expect(res.headers.etag).toBe('"v1"');
    expect(res.headers['content-security-policy']).toContain('sandbox');
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('serves a page only for kind=page, always sandboxed and nosniff; rejects unknown kinds', async () => {
    const routes = {
      'p.example.test': ok({
        headers: { 'content-type': 'text/html' },
        body: Buffer.from('<p>x</p>'),
      }),
    };
    const { app } = await setup({ proxy: fakeDeps(routes as never).deps });
    const url = 'https%3A%2F%2Fp.example.test%2Fx';
    const plain = await app.inject({ method: 'GET', url: `/v1/proxy?url=${url}`, headers: auth });
    expect(plain.statusCode).toBe(415);
    const page = await app.inject({
      method: 'GET',
      url: `/v1/proxy?url=${url}&kind=page`,
      headers: auth,
    });
    expect(page.statusCode).toBe(200);
    expect(page.headers['content-security-policy']).toContain('sandbox');
    expect(page.headers['x-content-type-options']).toBe('nosniff');
    const bad = await app.inject({
      method: 'GET',
      url: `/v1/proxy?url=${url}&kind=script`,
      headers: auth,
    });
    expect(bad.statusCode).toBe(400);
  });

  it('answers 304 when the client already has the version', async () => {
    const { app } = await setup({
      proxy: fakeDeps({
        'cal.example.test': { status: 304, headers: { etag: '"v1"' }, body: Buffer.alloc(0) },
      }).deps,
    });
    const res = await app.inject({
      method: 'GET',
      url: '/v1/proxy?url=https%3A%2F%2Fcal.example.test%2Fx.ics',
      headers: { ...auth, 'if-none-match': '"v1"' },
    });
    expect(res.statusCode).toBe(304);
    expect(res.headers.etag).toBe('"v1"');
  });

  it.each([
    ['https%3A%2F%2Flocalhost%2Fx', 'blocked', 403, { localhost: ['127.0.0.1'] }],
    ['http%3A%2F%2F169.254.169.254%2F', 'blocked', 403, {}],
    ['ftp%3A%2F%2Fexample.test%2Fx', 'invalid-url', 400, {}],
    [
      'https%3A%2F%2Fcal.example.test%2Fx',
      'unsupported-type',
      415,
      { 'cal.example.test': ok({ headers: { 'content-type': 'text/html' } }) },
    ],
  ])('maps %s to %s (%i)', async (url, error, status, routes) => {
    const { app } = await setup({ proxy: fakeDeps(routes as never).deps });
    const res = await app.inject({ method: 'GET', url: `/v1/proxy?url=${url}`, headers: auth });
    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({ error });
  });

  it('validates the query and rate-limits the route', async () => {
    const { app } = await setup({ proxy: fakeDeps({}).deps });
    expect((await app.inject({ method: 'GET', url: '/v1/proxy', headers: auth })).statusCode).toBe(
      400,
    );
    expect(
      (await app.inject({ method: 'GET', url: '/v1/proxy?url=x&extra=1', headers: auth }))
        .statusCode,
    ).toBe(400);
    let limited = 0;
    for (let i = 0; i < 70; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/proxy?url=https%3A%2F%2Fcal.example.test%2Fx',
        headers: auth,
      });
      if (res.statusCode === 429) limited += 1;
    }
    expect(limited).toBeGreaterThan(0);
  });
});
