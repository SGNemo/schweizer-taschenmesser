import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_CATEGORIES,
  catalogLang,
  groupCatalog,
  searchCatalog,
  suggestions,
  type CatalogCategory,
} from '../catalog';
import { feedKey, normalizeFeedUrl } from '../logic';

const label = (c: CatalogCategory) =>
  ({
    news: 'Nachrichten',
    tech: 'Technik',
    science: 'Wissenschaft',
    sport: 'Sport',
    gaming: 'Gaming',
    local: 'Lokal',
  })[c];

describe('starter catalogue data', () => {
  it('has unique ids and feeds', () => {
    expect(new Set(CATALOG.map((e) => e.id)).size).toBe(CATALOG.length);
    expect(new Set(CATALOG.map((e) => feedKey(e.url))).size).toBe(CATALOG.length);
  });

  it('only holds plain public https feed addresses without tracking parameters', () => {
    for (const e of CATALOG) {
      expect(normalizeFeedUrl(e.url), e.id).toBe(e.url);
      expect(e.url.startsWith('https://'), e.id).toBe(true);
      expect(e.site.startsWith('https://'), e.id).toBe(true);
      expect(e.url, e.id).not.toMatch(/[?&](utm_|fbclid|gclid|mc_|ref=|source=)/i);
      expect(new URL(e.url).username + new URL(e.url).password, e.id).toBe('');
    }
  });

  it('covers every group in German and English, with at least two sources each', () => {
    for (const lang of ['de', 'en'] as const)
      for (const category of CATALOG_CATEGORIES) {
        const n = CATALOG.filter((e) => e.lang === lang && e.category === category).length;
        expect([lang, category, n >= 2]).toEqual([lang, category, true]);
      }
  });

  it('names a region for every local source and no other', () => {
    for (const e of CATALOG) expect(Boolean(e.region), e.id).toBe(e.category === 'local');
  });

  it('is documented source by source', () => {
    const doc = readFileSync(
      resolve(__dirname, '../../../../../docs/design/feeds-deep/SOURCES.md'),
      'utf8',
    );
    for (const e of CATALOG) expect(doc, e.id).toContain(e.url);
  });
});

describe('catalogue search', () => {
  it('lists the chosen language when nothing is typed', () => {
    const all = searchCatalog('', 'de', label);
    expect(all.length).toBeGreaterThan(10);
    expect(all.every((e) => e.lang === 'de')).toBe(true);
  });

  it('finds by name, site, region and group name, without accents and case', () => {
    expect(searchCatalog('HEISE', 'de', label).map((e) => e.id)).toContain('heise');
    expect(searchCatalog('osterreich', 'de', label).map((e) => e.id)).toEqual(['orf']);
    expect(searchCatalog('spektrum.de', 'de', label).map((e) => e.id)).toEqual(['spektrum']);
    expect(searchCatalog('wissenschaft', 'de', label).every((e) => e.category === 'science')).toBe(
      true,
    );
  });

  it('needs every word and puts the chosen language first', () => {
    expect(searchCatalog('bbc sport', 'de', label).map((e) => e.id)).toEqual(['bbc-sport']);
    const news = searchCatalog('nachrichten', 'en', label);
    expect(news.length).toBeGreaterThan(0);
    const de = searchCatalog('news', 'de', label);
    expect(de[0]!.lang).toBe('de');
    expect(de.some((e) => e.lang === 'en')).toBe(true);
  });

  it('groups in catalogue order and leaves out empty groups', () => {
    const groups = groupCatalog(searchCatalog('bbc', 'en', label));
    expect(groups.map((g) => g.category)).toEqual(['news', 'sport', 'local']);
  });
});

describe('empty-page suggestions', () => {
  it('offers one news, one tech and one science source in the catalogue language', () => {
    const three = suggestions('de', new Set());
    expect(three.map((e) => e.category)).toEqual(['news', 'tech', 'science']);
    expect(three.every((e) => e.lang === 'de')).toBe(true);
  });

  it('skips what is already subscribed', () => {
    const first = suggestions('en', new Set())[0]!;
    const next = suggestions('en', new Set([feedKey(first.url)]))[0]!;
    expect(next.id).not.toBe(first.id);
    expect(next.category).toBe('news');
  });

  it('maps every app language to a catalogue language', () => {
    expect(catalogLang('de')).toBe('de');
    expect(catalogLang('en')).toBe('en');
    expect(catalogLang('fr')).toBe('en');
  });
});
