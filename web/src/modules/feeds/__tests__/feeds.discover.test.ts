// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { PublicFetchError } from '@/core/net/fetchPublic';
import { discoverFeedLinks, lookUp, PREVIEW_ITEMS } from '../discover';

const PAGE = `<!doctype html><html><head>
<title>Blog</title>
<link rel="alternate" type="application/rss+xml" title="Beiträge" href="/feed/">
<link rel="alternate" type="application/rss+xml" title="Kommentare" href="/comments/feed/">
<link rel="alternate" type="application/atom+xml" title="Atom" href="https://blog.example.org/atom.xml">
<link rel="alternate" type="application/rss+xml" href="/feed/">
<link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
<link rel="alternate" hreflang="en" href="/en/">
<link rel="stylesheet" type="text/css" href="/s.css">
</head><body><script>alert(1)</script></body></html>`;

const rss = (
  n: number,
) => `<?xml version="1.0"?><rss version="2.0"><channel><title>Werkstatt</title>
${Array.from(
  { length: n },
  (_, i) =>
    `<item><title>Artikel ${i + 1}</title><link>https://blog.example.org/${i + 1}</link><pubDate>${new Date(Date.UTC(2026, 10, 1 + i)).toUTCString()}</pubDate></item>`,
).join('')}
</channel></rss>`;

const reply = (body: string, status = 200) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain' } });

describe('feed discovery in a web page', () => {
  it('finds RSS and Atom links, resolves relative ones, drops doubles, comments and non-http', () => {
    expect(discoverFeedLinks(PAGE, 'https://blog.example.org/')).toEqual([
      { url: 'https://blog.example.org/feed/', title: 'Beiträge' },
      { url: 'https://blog.example.org/atom.xml', title: 'Atom' },
    ]);
  });

  it('honours <base href> and finds nothing on a page without feeds', () => {
    const html = `<head><base href="https://cdn.example.org/x/"><link rel="alternate" type="application/rss+xml" href="rss.xml"></head>`;
    expect(discoverFeedLinks(html, 'https://example.org/')[0]!.url).toBe(
      'https://cdn.example.org/x/rss.xml',
    );
    expect(discoverFeedLinks('<p>nur Text</p>', 'https://example.org/')).toEqual([]);
  });
});

describe('looking an address up (one click, at most three requests)', () => {
  it('a feed address shows the newest articles first, at most five', async () => {
    const fetcher = vi.fn(async () => reply(rss(8)));
    const r = await lookUp('https://blog.example.org/feed/', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(r.kind).toBe('feed');
    if (r.kind !== 'feed') return;
    expect(r.feed.title).toBe('Werkstatt');
    expect(r.feed.items).toHaveLength(PREVIEW_ITEMS);
    expect(r.feed.items[0]!.title).toBe('Artikel 8');
  });

  it('a website with one feed reads that feed', async () => {
    const one = `<link rel="alternate" type="application/rss+xml" href="/feed/">`;
    const fetcher = vi.fn(async (url: string, _i?: unknown, _t?: unknown, kind?: string) => {
      if (kind === 'page') return reply(one);
      return url.endsWith('/feed/') ? reply(rss(2)) : reply('{"error":"unsupported-type"}', 415);
    });
    const r = await lookUp('https://blog.example.org/', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(r).toMatchObject({ kind: 'feed', feed: { url: 'https://blog.example.org/feed/' } });
  });

  it('a website with several feeds offers them to choose', async () => {
    const fetcher = vi.fn(async (_u: string, _i?: unknown, _t?: unknown, kind?: string) =>
      kind === 'page' ? reply(PAGE) : reply('<html></html>'),
    );
    const r = await lookUp('https://blog.example.org/', fetcher);
    expect(r).toMatchObject({ kind: 'choices' });
    if (r.kind === 'choices') expect(r.links).toHaveLength(2);
  });

  it('says so when there is no feed, no proxy or no answer', async () => {
    const none = vi.fn(async (_u: string, _i?: unknown, _t?: unknown, kind?: string) =>
      kind === 'page' ? reply('<p>hallo</p>') : reply('nope', 415),
    );
    expect(await lookUp('https://example.org/', none)).toEqual({ kind: 'none' });
    const noProxy = vi.fn(async () => {
      throw new PublicFetchError('no-proxy');
    });
    expect(await lookUp('https://example.org/', noProxy)).toEqual({
      kind: 'error',
      reason: 'no-proxy',
    });
    const down = vi.fn(async () => {
      throw new PublicFetchError('timeout');
    });
    expect(await lookUp('https://example.org/', down)).toEqual({
      kind: 'error',
      reason: 'network',
    });
  });
});
