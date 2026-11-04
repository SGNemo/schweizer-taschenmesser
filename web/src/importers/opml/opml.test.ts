import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectSources } from '../registry';
import { buildOpml, looksLikeOpml, parseOpml } from './parse';

const fixture = readFileSync(
  resolve(process.cwd(), 'src/importers/__fixtures__/subscriptions.opml'),
  'utf8',
);

describe('OPML', () => {
  const r = parseOpml(fixture);

  it('reads feeds with their folder, nested folders use the innermost name', () => {
    expect(r.invalid).toBe(false);
    const by = (title: string) => r.feeds.find((f) => f.title === title)!;
    expect(by('Tagesbericht & Mehr')).toMatchObject({
      url: 'https://tagesbericht.example.org/feed.xml',
      siteUrl: 'https://tagesbericht.example.org',
      category: 'Nachrichten',
    });
    expect(by('Der Werkstatt-Podcast').category).toBe('Technik');
    expect(by('Kochen am Sonntag').category).toBe('Podcasts');
    expect(by('Ohne Gruppe').category).toBe('');
    expect(by('Einfache "Quotes"').url).toBe('https://q.example.org/f');
  });

  it('leaves out addresses that are not http(s) and counts them', () => {
    expect(r.feeds.some((f) => f.url.startsWith('javascript') || f.url.startsWith('ftp'))).toBe(
      false,
    );
    expect(r.skipped.unsupported).toBe(2);
    expect(r.feeds).toHaveLength(6);
  });

  it('is detected by content, rejects other files and survives broken input', () => {
    expect(detectSources([{ name: 'x.xml', text: fixture }])[0]!.source.id).toBe('opml');
    expect(looksLikeOpml('{"a":1}')).toBe(false);
    expect(parseOpml('<html></html>').invalid).toBe(true);
    expect(parseOpml('<opml><body><outline text="x" xmlUrl="https://a.example/f"').feeds).toEqual(
      [],
    );
    expect(parseOpml('').invalid).toBe(true);
  });

  it('exports what it reads: groups, escaping, round trip', () => {
    const out = buildOpml(r.feeds, 'Meine <Feeds> & "Mehr"');
    expect(out).toContain('<title>Meine &lt;Feeds&gt; &amp; &quot;Mehr&quot;</title>');
    expect(out).toContain('text="Tagesbericht &amp; Mehr"');
    const back = parseOpml(out);
    const key = (f: { url: string; category: string; title: string }) =>
      `${f.category}|${f.title}|${f.url}`;
    expect(back.feeds.map(key).sort()).toEqual(r.feeds.map(key).sort());
  });
});
