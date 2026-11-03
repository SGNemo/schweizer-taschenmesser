// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseReadable } from './readable';

const para = (n: number) => `<p>${'Satz Nummer eins ist lang genug. '.repeat(n)}</p>`;

describe('parseReadable', () => {
  it('extracts the article and drops menus, footers, forms and scripts', () => {
    const r = parseReadable(`<html><head><title>Seite</title></head><body>
      <nav><ul><li><a href="/">Start</a></li><li><a href="/x">Kontakt</a></li></ul></nav>
      <header><h1>Seitenkopf</h1></header>
      <article><h1>Der Aufmacher</h1><p>Erster Absatz mit genug Text, damit er gelesen wird. ${'Mehr Text. '.repeat(10)}</p>
        <h2>Zwischenüberschrift</h2>${para(3)}
        <blockquote>Ein Zitat, das bleibt.</blockquote><ul><li>Punkt eins</li><li>Punkt zwei</li></ul></article>
      <aside><p>Werbung</p></aside><form><p>Newsletter</p></form>
      <footer><p>Impressum</p></footer><script>alert(1)</script></body></html>`);
    expect(r.title).toBe('Der Aufmacher');
    const all = r.blocks.map((b) => b.text).join('|');
    expect(all).not.toMatch(/Start|Kontakt|Werbung|Newsletter|Impressum|alert/);
    expect(r.blocks.some((b) => b.type === 'h' && b.text === 'Zwischenüberschrift')).toBe(true);
    expect(r.blocks.some((b) => b.type === 'quote' && b.text.includes('Zitat'))).toBe(true);
    expect(r.blocks.filter((b) => b.type === 'li')).toHaveLength(2);
    // the page's own title is not repeated as the first block
    expect(r.blocks[0]).toMatchObject({ type: 'p' });
  });

  it('finds the content without an <article> by paragraph weight', () => {
    const r = parseReadable(
      `<body><div id="menu"><p>Kurz</p></div><div id="c">${para(6)}${para(6)}</div></body>`,
    );
    expect(r.blocks.length).toBeGreaterThanOrEqual(2);
    expect(r.blocks.map((b) => b.text).join(' ')).not.toContain('Kurz');
  });

  it('returns no blocks for pages that are not article-like', () => {
    expect(parseReadable('<body><nav><a href="/">A</a></nav><p>Hallo</p></body>').blocks).toEqual(
      [],
    );
  });

  it('yields plain text only: markup, handlers and links never survive', () => {
    const r = parseReadable(
      `<article><p onclick="steal()">Vorne <a href="javascript:alert(1)">Link</a> <img src=x onerror="alert(1)"> hinten. ${'Füllung. '.repeat(30)}</p>
       <iframe src="https://evil.example"></iframe><object data="x"></object></article>`,
    );
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/onclick|onerror|javascript:|<img|<a |iframe|evil/);
    expect(r.blocks[0]!.text).toContain('Vorne Link');
  });

  it('caps the number of blocks and the length of a block', () => {
    const many =
      '<article>' + '<p>Ein kurzer Absatz mit etwas Text darin.</p>'.repeat(600) + '</article>';
    expect(parseReadable(many).blocks.length).toBeLessThanOrEqual(400);
    const long = parseReadable(`<article><p>${'wort '.repeat(2000)}</p></article>`);
    expect(long.blocks[0]!.text.length).toBeLessThanOrEqual(2002);
  });
});
