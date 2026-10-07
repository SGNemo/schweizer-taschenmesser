// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { fetchPublic, MAX_PUBLIC_BYTES } from './fetchPublic';

/** A native platform whose fetch answers with the given response. */
function nativeWith(answer: (url: string) => Response | Promise<Response>) {
  const web = createWebPlatform();
  setPlatform({
    ...web,
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL) => answer(String(input))) as typeof fetch,
  });
}

/** A body delivered as a stream of several chunks (no content-length header). */
function streamed(chunks: string[], type: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'content-type': type } });
}

const FEED = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n';

afterEach(() => setPlatform(undefined));

describe('fetchPublic (native branch)', () => {
  it('passes a calendar of an allowed type through unchanged', async () => {
    nativeWith(
      () =>
        new Response(FEED, {
          status: 200,
          headers: { 'content-type': 'text/calendar; charset=utf-8' },
        }),
    );
    const res = await fetchPublic('https://cal.example.test/x.ics');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(FEED);
  });

  it.each(['text/plain', 'application/octet-stream', 'application/rss+xml', 'text/xml'])(
    'accepts %s like the server proxy',
    async (type) => {
      nativeWith(() => new Response(FEED, { status: 200, headers: { 'content-type': type } }));
      expect((await fetchPublic('https://cal.example.test/x.ics')).status).toBe(200);
    },
  );

  it.each(['text/html', 'application/json', 'image/png', ''])(
    'rejects content type "%s" the way the proxy does (415, { error })',
    async (type) => {
      nativeWith(
        () => new Response('<html>hi</html>', { status: 200, headers: { 'content-type': type } }),
      );
      const res = await fetchPublic('https://cal.example.test/x.ics');
      expect(res.ok).toBe(false);
      expect(res.status).toBe(415);
      expect(await res.json()).toEqual({ error: 'unsupported-type' });
    },
  );

  it('rejects a body that announces more than 2 MB in content-length', async () => {
    nativeWith(
      () =>
        new Response(FEED, {
          status: 200,
          headers: {
            'content-type': 'text/calendar',
            'content-length': String(MAX_PUBLIC_BYTES + 1),
          },
        }),
    );
    const res = await fetchPublic('https://cal.example.test/x.ics');
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too-large' });
  });

  it('stops reading a streamed body once it exceeds 2 MB', async () => {
    const chunk = 'X'.repeat(512 * 1024);
    nativeWith(() => streamed(Array<string>(5).fill(chunk), 'text/calendar')); // 2.5 MB
    const res = await fetchPublic('https://cal.example.test/x.ics');
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'too-large' });
  });

  it('keeps a streamed body that fits', async () => {
    nativeWith(() => streamed(['BEGIN:VCALENDAR\r\n', 'END:VCALENDAR\r\n'], 'text/calendar'));
    const res = await fetchPublic('https://cal.example.test/x.ics');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe(FEED);
  });

  it('leaves error responses alone so the caller can read the status', async () => {
    nativeWith(
      () => new Response('nope', { status: 404, headers: { 'content-type': 'text/html' } }),
    );
    expect((await fetchPublic('https://cal.example.test/x.ics')).status).toBe(404);
    nativeWith(() => new Response(null, { status: 429, headers: { 'retry-after': '90' } }));
    const limited = await fetchPublic('https://cal.example.test/x.ics');
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).toBe('90');
  });

  it('wraps a failing fetch as a network error', async () => {
    nativeWith(() => {
      throw new TypeError('offline');
    });
    await expect(fetchPublic('https://cal.example.test/x.ics')).rejects.toMatchObject({
      name: 'PublicFetchError',
      code: 'network',
    });
  });
});
