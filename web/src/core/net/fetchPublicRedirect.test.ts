// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { checkRedirect, nativeInit } from '@/core/platform/tauri/redirect';
import { fetchPublic, nextHop } from './fetchPublic';

// M2 (launch review 2026-11): on the desktop `fetchPublic` judged only the first address and the
// native fetch followed redirects itself – to a home-network address too. It now follows them
// itself and checks every hop; `redirect: 'error'` refuses a redirect natively as in a browser.
const seen: { url: string; init?: RequestInit }[] = [];
function nativeWith(answer: (url: string) => Response) {
  seen.length = 0;
  setPlatform({
    ...createWebPlatform(),
    kind: 'desktop',
    isNative: true,
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), init });
      return answer(String(input));
    }) as typeof fetch,
  });
}
const moved = (to: string) => new Response(null, { status: 302, headers: { location: to } });
const ics = () =>
  new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', {
    headers: { 'content-type': 'text/calendar' },
  });

afterEach(() => setPlatform(undefined));

describe('fetchPublic redirects (native)', () => {
  it('asks the native fetch not to follow by itself', async () => {
    nativeWith(() => ics());
    await fetchPublic('https://cal.example.test/a.ics');
    expect(seen[0]!.init?.redirect).toBe('manual');
  });

  it('refuses a redirect to a home-network or plain-http address', async () => {
    for (const to of [
      'https://192.168.1.1/x',
      'http://cal.example.test/x',
      'https://localhost/x',
    ]) {
      nativeWith((url) => (url.includes('/a.ics') ? moved(to) : ics()));
      await expect(fetchPublic('https://cal.example.test/a.ics'), to).rejects.toMatchObject({
        code: 'network',
      });
      expect(seen.map((s) => s.url)).toEqual(['https://cal.example.test/a.ics']);
    }
  });

  it('follows a redirect to another public https address', async () => {
    nativeWith((url) => (url.endsWith('/a.ics') ? moved('/b.ics') : ics()));
    const res = await fetchPublic('https://cal.example.test/a.ics');
    expect(res.status).toBe(200);
    expect(seen.map((s) => s.url)).toEqual([
      'https://cal.example.test/a.ics',
      'https://cal.example.test/b.ics',
    ]);
  });

  it('stops after a few hops', async () => {
    let n = 0;
    nativeWith(() => moved(`https://cal.example.test/${++n}.ics`));
    await expect(fetchPublic('https://cal.example.test/0.ics')).rejects.toMatchObject({
      code: 'network',
    });
    expect(seen.length).toBeLessThanOrEqual(6);
  });
});

describe('the next hop (council round 1)', () => {
  it('turns 303, and 301/302 after a POST, into a GET without body', () => {
    const post: RequestInit = { method: 'POST', body: 'x' };
    expect(nextHop(post, 303, false)).toMatchObject({ method: 'GET', body: undefined });
    expect(nextHop(post, 302, false)).toMatchObject({ method: 'GET', body: undefined });
    expect(nextHop(post, 307, false)).toMatchObject({ method: 'POST', body: 'x' });
  });

  it('never carries credentials to another origin', () => {
    const init: RequestInit = { headers: { authorization: 'Bearer t', accept: 'text/html' } };
    const cross = new Headers(nextHop(init, 302, true).headers);
    expect(cross.get('authorization')).toBeNull();
    expect(cross.get('accept')).toBe('text/html');
    expect(new Headers(nextHop(init, 302, false).headers).get('authorization')).toBe('Bearer t');
  });
});

describe("redirect: 'error' natively", () => {
  it('asks the plugin to follow nothing and turns a 3xx into an error', () => {
    expect(nativeInit({ redirect: 'error' })).toMatchObject({ maxRedirections: 0 });
    expect(() => checkRedirect(moved('https://x.test/'), { redirect: 'error' })).toThrow(TypeError);
    expect(() => checkRedirect(new Response('ok'), { redirect: 'error' })).not.toThrow();
    expect(() => checkRedirect(moved('https://x.test/'), { redirect: 'manual' })).not.toThrow();
  });
});
