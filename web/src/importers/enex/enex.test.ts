import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseEnex } from './parse';
import { enmlToMarkdown } from './enml';

const fixture = readFileSync(new URL('../__fixtures__/notes.enex', import.meta.url), 'utf8');

describe('ENEX', () => {
  const result = parseEnex(fixture);

  it('reads notes with title, tags and Markdown body', () => {
    expect(result.total).toBe(3);
    expect(result.notes).toHaveLength(2);
    const first = result.notes[0]!;
    expect(first.title).toBe('Einkaufsliste & Ideen');
    expect(first.tags).toEqual(['Haushalt', 'Zu-Hause']);
    expect(first.body).toContain('**Wichtig:** Müsli, Äpfel & Brot');
    expect(first.body).toContain('- Milch');
    expect(first.body).toContain('  - Bio');
    expect(first.body).toContain('- [x] Kaffee gekauft');
    expect(first.body).toContain('- [ ] Tee kaufen');
    expect(first.body).toContain('[Rezept](https://example.org/rezept?a=1&b=2)');
    expect(first.body).toContain('#Haushalt #Zu-Hause');
  });

  it('counts attachments and empty notes instead of storing them', () => {
    expect(result.skipped.attachment).toBe(1);
    expect(result.skipped.empty).toBe(1);
  });

  it('converts headings, line breaks, code and tables', () => {
    const body = result.notes[1]!.body;
    expect(body).toContain('## Überschrift');
    expect(body).toContain('Zeile 1\nZeile 2');
    expect(body).toContain('```\ncode <b>\n  eingerückt\n```');
    expect(body).toContain('A | B');
  });

  it('rejects files that are no Evernote export', () => {
    expect(parseEnex('{"a":1}').invalid).toBe(true);
    expect(parseEnex('<en-export></en-export>').invalid).toBe(true);
    expect(parseEnex('').invalid).toBe(true);
  });

  it('survives a truncated file', () => {
    const cut = fixture.slice(0, fixture.indexOf('</note>') + 40);
    const r = parseEnex(cut);
    expect(r.invalid).toBe(false);
    expect(r.notes).toHaveLength(1);
  });

  it('decodes numeric entities and ignores invalid code points', () => {
    expect(enmlToMarkdown('<en-note>&#228;&#x20AC;&#0;</en-note>').markdown).toBe('ä€');
  });
});
