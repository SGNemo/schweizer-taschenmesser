// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseBookmarksHtml } from './bookmarksHtml';

const FIXTURE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1">Lesezeichenleiste</H3>
  <DL><p>
    <DT><A HREF="https://example.org/wetter" ADD_DATE="1">Wetter</A>
    <DT><H3>Kochen</H3>
    <DL><p>
      <DT><A HREF="https://example.org/rezepte">Rezepte</A>
      <DT><A HREF="https://example.org/rezepte">Rezepte (doppelt)</A>
      <DT><H3>Backen</H3>
      <DL><p>
        <DT><A HREF="https://example.org/brot">Brot</A>
      </DL><p>
    </DL><p>
    <DT><A HREF="javascript:alert(1)">Bookmarklet</A>
    <DT><A HREF="ftp://example.org/file">FTP</A>
    <DT><A HREF="">Leer</A>
  </DL><p>
  <DT><A HREF="http://example.net/">http://example.net/</A>
</DL><p>`;

describe('parseBookmarksHtml', () => {
  const items = parseBookmarksHtml(FIXTURE);

  it('keeps http(s) links only and drops duplicates', () => {
    expect(items.map((i) => i.url)).toEqual([
      'https://example.org/wetter',
      'https://example.org/rezepte',
      'https://example.org/brot',
      'http://example.net/',
    ]);
  });

  it('turns folders into tags, ignoring the browser root folders', () => {
    const byTitle = Object.fromEntries(items.map((i) => [i.title, i.tags]));
    expect(byTitle['Wetter']).toEqual([]);
    expect(byTitle['Rezepte']).toEqual(['kochen']);
    expect(byTitle['Brot']).toEqual(['kochen', 'backen']);
  });

  it('is empty for a file without links', () => {
    expect(parseBookmarksHtml('<html><body>nothing</body></html>')).toEqual([]);
  });
});
