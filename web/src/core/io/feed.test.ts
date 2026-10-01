// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { FeedFormatError, MAX_ITEMS, parseFeed, plainText, safeHttpUrl } from './feed';

const NOW = Date.UTC(2026, 8, 29, 12, 0);

// Invented feeds.
const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>
  <title>Beispiel-Nachrichten</title>
  <item>
    <title>Neue Brücke eröffnet &amp; gefeiert</title>
    <link>https://news.example.test/bruecke</link>
    <guid isPermaLink="false">id-1</guid>
    <description><![CDATA[<p>Die <b>Brücke</b> ist offen.</p><script>alert(1)</script><img src="https://tracker.example.test/x.gif">]]></description>
    <pubDate>Tue, 29 Sep 2026 08:30:00 +0200</pubDate>
  </item>
  <item>
    <title>Ohne Guid</title>
    <link>https://news.example.test/ohne-guid</link>
    <dc:date>2026-09-28T10:00:00Z</dc:date>
  </item>
  <item><title>Zukunft</title><link>https://news.example.test/z</link><pubDate>Wed, 01 Jan 2031 00:00:00 GMT</pubDate></item>
  <item><title>Böser Link</title><link>javascript:alert(1)</link></item>
  <item><title></title><link>https://news.example.test/leer</link></item>
</channel></rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Technik-Blog</title>
  <entry>
    <id>tag:example.test,2026:1</id>
    <title type="html">Neuer Prozessor</title>
    <link rel="self" href="https://blog.example.test/feed/1"/>
    <link rel="alternate" href="/artikel/1"/>
    <summary>Kurz &lt;i&gt;und&lt;/i&gt; knapp</summary>
    <updated>2026-09-27T09:00:00Z</updated>
  </entry>
  <entry>
    <id>tag:example.test,2026:2</id>
    <title>Mit Inhalt</title>
    <content type="html">&lt;p&gt;Langer Text&lt;/p&gt;</content>
    <published>2026-09-26T09:00:00Z</published>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://old.example.test/"><title>Alt-Feed</title></channel>
  <item rdf:about="https://old.example.test/a"><title>Alter Artikel</title><link>https://old.example.test/a</link><description>Text</description><dc:date>2026-09-20T00:00:00Z</dc:date></item>
</rdf:RDF>`;

describe('plainText', () => {
  it('drops markup, decodes entities, collapses whitespace and never runs anything', () => {
    expect(
      plainText(
        '<p>Hallo&nbsp;<b>Welt</b></p>\n\n<script>alert(1)</script><style>p{}</style>  ok',
        100,
      ),
    ).toBe('Hallo Welt ok');
    expect(plainText('a &amp;lt; b', 100)).toBe('a &lt; b');
  });
  it('shortens at a word boundary', () => {
    const out = plainText('wort '.repeat(100), 50);
    expect(out.length).toBeLessThanOrEqual(52);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('safeHttpUrl', () => {
  it('keeps http(s), resolves relative links and refuses everything else', () => {
    expect(safeHttpUrl('https://a.example.test/x')).toBe('https://a.example.test/x');
    expect(safeHttpUrl('/x', 'https://a.example.test/feed')).toBe('https://a.example.test/x');
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'https://u:p@a.example.test/',
      '',
      undefined,
    ])
      expect(safeHttpUrl(bad)).toBeUndefined();
  });
});

describe('parseFeed', () => {
  it('reads RSS 2.0 as safe plain text', () => {
    const feed = parseFeed(RSS, NOW);
    expect(feed.title).toBe('Beispiel-Nachrichten');
    expect(feed.items.map((i) => i.title)).toEqual([
      'Neue Brücke eröffnet & gefeiert',
      'Ohne Guid',
      'Zukunft',
      'Böser Link',
    ]);
    const first = feed.items[0]!;
    expect(first).toMatchObject({
      guid: 'id-1',
      url: 'https://news.example.test/bruecke',
      teaser: 'Die Brücke ist offen.',
    });
    expect(first.publishedAt).toBe(Date.UTC(2026, 8, 29, 6, 30));
    expect(first.teaser).not.toMatch(/alert|<|tracker/);
    expect(feed.items[1]).toMatchObject({
      guid: 'https://news.example.test/ohne-guid',
      publishedAt: Date.UTC(2026, 8, 28, 10),
    });
    expect(feed.items[2]!.publishedAt).toBe(NOW); // dates in the future are clamped
    expect(feed.items[3]!.url).toBeUndefined(); // javascript: dropped
  });

  it('reads Atom with alternate links (relative to the feed URL) and summary/content', () => {
    const feed = parseFeed(ATOM, NOW, 'https://blog.example.test/feed.xml');
    expect(feed.title).toBe('Technik-Blog');
    expect(feed.items).toHaveLength(2);
    expect(feed.items[0]).toMatchObject({
      guid: 'tag:example.test,2026:1',
      url: 'https://blog.example.test/artikel/1',
      teaser: 'Kurz und knapp',
    });
    expect(feed.items[1]).toMatchObject({
      teaser: 'Langer Text',
      publishedAt: Date.UTC(2026, 8, 26, 9),
    });
    expect(feed.items[1]!.url).toBeUndefined();
  });

  it('reads RSS 1.0 (RDF)', () => {
    const feed = parseFeed(RDF, NOW);
    expect(feed.title).toBe('Alt-Feed');
    expect(feed.items[0]).toMatchObject({
      title: 'Alter Artikel',
      guid: 'https://old.example.test/a',
      publishedAt: Date.UTC(2026, 8, 20),
    });
  });

  it('ignores duplicates and caps the number of entries', () => {
    const many = `<rss><channel><title>x</title>${Array.from({ length: 300 }, (_, i) => `<item><title>T${i}</title><guid>g${i % 250}</guid></item>`).join('')}</channel></rss>`;
    const feed = parseFeed(many, NOW);
    expect(feed.items).toHaveLength(MAX_ITEMS);
    expect(new Set(feed.items.map((i) => i.guid)).size).toBe(MAX_ITEMS);
  });

  it('accepts a byte order mark and rejects anything that is not a feed', () => {
    expect(parseFeed(`${String.fromCharCode(0xfeff)}${RSS}`, NOW).items.length).toBeGreaterThan(0);
    for (const bad of [
      '<html><body>hi</body></html>',
      'kein xml',
      '<rss><nochannel/></rss>',
      '<a>',
    ])
      expect(() => parseFeed(bad, NOW), bad).toThrow(FeedFormatError);
  });

  it('survives hostile markup: entities bomb-like and huge titles are bounded', () => {
    const title = 'A'.repeat(5000);
    const feed = parseFeed(
      `<rss><channel><title>t</title><item><title>${title}</title><description>${'B'.repeat(20000)}</description></item></channel></rss>`,
      NOW,
    );
    expect(feed.items[0]!.title.length).toBeLessThanOrEqual(202);
    expect(feed.items[0]!.teaser.length).toBeLessThanOrEqual(302);
  });
});
