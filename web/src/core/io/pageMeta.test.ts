// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parsePageMeta } from './pageMeta';

const URL_ = 'https://news.example.org/a/b';

describe('parsePageMeta', () => {
  it('reads Open Graph data and resolves a relative image against the page', () => {
    const meta = parsePageMeta(
      `<html><head><title>Fallback</title>
       <meta property="og:title" content="Der Titel">
       <meta property="og:description" content="Eine  kurze   Beschreibung.">
       <meta property="og:site_name" content="Beispiel Magazin">
       <meta property="og:image" content="/img/cover.jpg"></head><body></body></html>`,
      URL_,
    );
    expect(meta).toEqual({
      title: 'Der Titel',
      description: 'Eine kurze Beschreibung.',
      siteName: 'Beispiel Magazin',
      imageUrl: 'https://news.example.org/img/cover.jpg',
    });
  });

  it('falls back to <title>, twitter tags and the plain description', () => {
    const meta = parsePageMeta(
      `<title> Nur Titel </title><meta name="description" content="Kurz">
       <meta name="twitter:image" content="https://cdn.example.org/x.png">`,
      URL_,
    );
    expect(meta.title).toBe('Nur Titel');
    expect(meta.description).toBe('Kurz');
    expect(meta.imageUrl).toBe('https://cdn.example.org/x.png');
  });

  it('keeps only https images with no credentials', () => {
    for (const bad of [
      'http://cdn.example.org/x.png',
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'https://user:pw@cdn.example.org/x.png',
    ])
      expect(parsePageMeta(`<meta property="og:image" content="${bad}">`, URL_).imageUrl).toBe(
        undefined,
      );
  });

  it('reduces markup in texts to plain text and never keeps script', () => {
    const meta = parsePageMeta(
      `<meta property="og:title" content="&lt;img src=x onerror=alert(1)&gt;Hallo &lt;b&gt;Welt&lt;/b&gt;">
       <meta property="og:description" content="&lt;script&gt;alert(1)&lt;/script&gt;Text">`,
      URL_,
    );
    expect(meta.title).toBe('Hallo Welt');
    expect(meta.description).toBe('Text');
  });

  it('returns nothing for a page without data', () => {
    expect(parsePageMeta('<p>hi</p>', URL_)).toEqual({
      title: undefined,
      description: undefined,
      siteName: undefined,
      imageUrl: undefined,
    });
  });
});
