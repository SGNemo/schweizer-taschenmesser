// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  cleanStyle,
  fetchRemoteImages,
  mailDocument,
  sanitizeMailHtml,
  textToHtml,
} from './sanitize';

const clean = (html: string, opts = {}) => sanitizeMailHtml(html, opts);

describe('sanitizeMailHtml', () => {
  it('removes scripts, event handlers, frames, forms, style blocks and javascript links', () => {
    const { html } = clean(
      '<p onclick="x()">Hi</p><script>alert(1)</script><iframe src="https://evil.example"></iframe>' +
        '<form action="https://evil.example"><input name="a"></form><style>p{background:url(https://t.example/x)}</style>' +
        '<a href="javascript:alert(1)">klick</a><img src="https://img.example/a.png" onerror="x()">',
    );
    expect(html).not.toMatch(/<script|onclick|onerror|<iframe|<form|<input|<style|javascript:/i);
    expect(html).toContain('Hi');
    expect(html).toContain('klick');
  });

  it('withholds remote images and lists them; tracking pixels vanish without being listed', () => {
    const r = clean(
      '<img src="https://cdn.example/logo.png" width="120">' +
        '<img src="https://track.example/p.gif" width="1" height="1">' +
        '<img src="https://track.example/q.gif" style="display:none">',
    );
    expect(r.html).not.toContain('https://cdn.example/logo.png');
    expect(r.html).not.toContain('track.example');
    expect(r.remoteImages).toEqual(['https://cdn.example/logo.png']);
    expect(r.blocked).toBe(1);
    expect(r.trackers).toBe(2);
  });

  it('shows a remote image only when its downloaded data URL is handed in', () => {
    const data = 'data:image/png;base64,AAAA';
    const r = clean('<img src="https://cdn.example/logo.png" width="120">', {
      images: { 'https://cdn.example/logo.png': data },
    });
    expect(r.html).toContain(data);
    expect(r.html).not.toContain('https://cdn.example');
    expect(r.blocked).toBe(0);
  });

  it('never keeps a tracking pixel, even when images are allowed', () => {
    const r = clean('<img src="https://t.example/p.gif" width="1" height="1">', {
      images: { 'https://t.example/p.gif': 'data:image/gif;base64,AAAA' },
    });
    expect(r.html).not.toContain('t.example');
    expect(r.html).not.toContain('data:image/gif');
  });

  it('resolves cid images and drops unknown ones', () => {
    const r = clean('<img src="cid:logo@x" width="80"><img src="cid:other" width="80">', {
      cid: { 'logo@x': 'data:image/png;base64,BBBB' },
    });
    expect(r.html).toContain('data:image/png;base64,BBBB');
    expect(r.html).not.toContain('cid:');
  });

  it('keeps safe links with rel, drops other schemes', () => {
    const { html } = clean(
      '<a href="https://example.org/a" target="_blank">ok</a><a href="data:text/html,x">bad</a><a href="mailto:a@example.org">mail</a>',
    );
    expect(html).toContain('href="https://example.org/a"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).not.toContain('target=');
    expect(html).not.toContain('data:text/html');
    expect(html).toContain('mailto:a@example.org');
  });

  it('strips CSS that could load or run something but keeps layout', () => {
    const { html } = clean(
      '<div style="color: red; background: url(https://t.example/b.png); width: expression(alert(1))">x</div>',
    );
    expect(html).toContain('color: red');
    expect(html).not.toMatch(/url\(|expression|t\.example/);
    expect(cleanStyle('a:b;@import url(x);c:d')).toBe('a:b; c:d');
  });

  it('removes svg, srcset, background attributes and ids', () => {
    const { html } = clean(
      '<svg onload="x()"><circle/></svg><img srcset="https://a.example/1.png 1x" src="data:image/png;base64,CC"><table background="https://a.example/bg.png" id="x"><tr><td>c</td></tr></table>',
    );
    expect(html).not.toMatch(/<svg|srcset|background=|id="x"|a\.example/);
  });
});

describe('mailDocument / textToHtml', () => {
  it('wraps the body in a document with a locked-down CSP', () => {
    const doc = mailDocument('<p>x</p>');
    expect(doc).toContain("default-src 'none'");
    expect(doc).toContain('img-src data:');
    expect(doc).not.toMatch(/script-src|connect-src https/);
  });

  it('escapes plain text and links http(s) addresses only', () => {
    const html = textToHtml('<b>hi</b> https://example.org/x?y=1. javascript:alert(1)');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt;');
    expect(html).toContain('<a href="https://example.org/x?y=1"');
    expect(html).not.toContain('<a href="javascript');
  });
});

describe('fetchRemoteImages', () => {
  const png = new Uint8Array([137, 80, 78, 71]);
  it('returns data URLs for images, skips other types, big files and failures', async () => {
    const seen: RequestInit[] = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      seen.push(init!);
      if (url.endsWith('ok.png'))
        return new Response(png, { status: 200, headers: { 'content-type': 'image/png' } });
      if (url.endsWith('page.html'))
        return new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } });
      if (url.endsWith('big.png'))
        return new Response(new Uint8Array(20), {
          status: 200,
          headers: { 'content-type': 'image/png' },
        });
      throw new Error('offline');
    }) as unknown as typeof fetch;
    const out = await fetchRemoteImages(
      [
        'https://a.example/ok.png',
        'https://a.example/page.html',
        'https://a.example/big.png',
        'https://a.example/x.png',
      ],
      fetchFn,
      { maxBytes: 10 },
    );
    expect(Object.keys(out)).toEqual(['https://a.example/ok.png']);
    expect(out['https://a.example/ok.png']).toMatch(/^data:image\/png;base64,/);
    expect(seen[0]).toMatchObject({ referrerPolicy: 'no-referrer', credentials: 'omit' });
  });
});
