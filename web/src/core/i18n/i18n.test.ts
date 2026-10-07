// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineBundle } from './bundle';
import { catalogChain, loadCatalog, provideCatalog } from './catalogs';
import {
  getLang,
  getLangPref,
  initLang,
  matchLang,
  readLangPref,
  resolveLang,
  setLang,
  setLangLoader,
  setLangPref,
} from './lang';
import { localize } from './localize';

const b = defineBundle(
  { hello: 'Hallo', n: (x: number) => `${x} Einträge`, nested: { a: 'A' } },
  {
    en: { hello: 'Hello', n: (x: number) => `${x} entries`, nested: { a: 'A' } },
    es: { hello: 'Hola', n: (x: number) => `${x} entradas`, nested: { a: 'A' } },
    fr: { hello: 'Bonjour', n: (x: number) => `${x} entrées`, nested: { a: 'A' } },
    'pt-BR': { hello: 'Olá', n: (x: number) => `${x} entradas`, nested: { a: 'A' } },
  },
);

const source = {
  title: 'Titel',
  count: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
  list: ['eins', 'zwei'],
  kinds: { a: 'Erster', b: 'Zweiter' } as Record<string, string>,
  deep: { only: 'nur Deutsch' },
};
const en = {
  title: 'Title',
  count: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
  list: ['one', 'two'],
  kinds: { a: 'First', b: 'Second' },
  deep: { only: 'English only' },
};
const fr = { title: 'Titre', kinds: { a: 'Premier' } };
const text = localize(source, () => {
  const lang = getLang();
  if (lang === 'fr') return [fr, en];
  if (lang === 'en') return [en];
  return [];
});

describe('language preference', () => {
  beforeEach(() => {
    localStorage.clear();
    setLang('de');
  });
  afterEach(() => vi.restoreAllMocks());

  it('matches device languages to the five it speaks, English otherwise', () => {
    expect(matchLang(['de-CH'])).toBe('de');
    expect(matchLang(['pt-PT'])).toBe('pt-BR');
    expect(matchLang(['fr-CA', 'en'])).toBe('fr');
    expect(matchLang(['ja', 'es-MX'])).toBe('es');
    expect(matchLang(['ja', 'ko'])).toBe('en');
    expect(matchLang([])).toBe('en');
  });

  it('"system" follows the device language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES', 'en']);
    expect(resolveLang('system')).toBe('es');
  });

  it('stores the choice and ignores unknown values', async () => {
    await setLangPref('fr');
    expect(readLangPref()).toBe('fr');
    expect(getLang()).toBe('fr');
    expect(document.documentElement.lang).toBe('fr');
    localStorage.setItem('tm-lang', 'xx');
    expect(readLangPref()).toBe('system');
  });

  it('keeps German for an installation that already has data, follows the device otherwise', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
    localStorage.clear();
    await initLang(async () => true);
    expect(getLangPref()).toBe('de');
    expect(getLang()).toBe('de');

    localStorage.clear();
    await initLang(async () => false);
    expect(getLangPref()).toBe('system');
    expect(getLang()).toBe('en');
    // A later start keeps the decision, even though the database exists by then.
    await initLang(async () => true);
    expect(getLangPref()).toBe('system');
  });

  it('starts in German when the texts of the chosen language cannot load', async () => {
    setLang('fr');
    setLangLoader(() => Promise.reject(new Error('chunk missing')));
    try {
      await initLang(async () => true);
      expect(getLang()).toBe('de');
      expect(getLangPref()).toBe('fr'); // the choice stays for the next start
    } finally {
      setLangLoader(loadCatalog);
    }
  });
});

describe('localized texts', () => {
  beforeEach(() => setLang('de'));

  it('reads every text at access time, so a switch needs no reload', () => {
    const captured = text.kinds;
    expect(text.title).toBe('Titel');
    setLang('en');
    expect(text.title).toBe('Title');
    expect(text.count(2)).toBe('2 entries');
    expect(text.list).toEqual(['one', 'two']);
    expect(captured.a).toBe('First');
  });

  it('falls back from the current language to English, then German', () => {
    setLang('fr');
    expect(text.title).toBe('Titre');
    expect(text.kinds.a).toBe('Premier');
    expect(text.kinds.b).toBe('Second');
    expect(text.count(1)).toBe('1 entry');
    setLang('de');
    expect(text.deep.only).toBe('nur Deutsch');
  });

  it('keeps the keys of the source for iteration', () => {
    setLang('en');
    expect(Object.keys(text.kinds)).toEqual(['a', 'b']);
    expect(Object.entries(text.kinds)).toEqual([
      ['a', 'First'],
      ['b', 'Second'],
    ]);
    expect(JSON.stringify(text.deep)).toBe('{"only":"English only"}');
  });

  it('puts the current catalog first and needs none for German', () => {
    setLang('de');
    expect(catalogChain()).toEqual([]);
    provideCatalog('es', { x: 1 });
    setLang('es');
    expect(catalogChain()[0]).toEqual({ x: 1 });
  });
});

describe('bundles', () => {
  beforeEach(() => setLang('de'));

  it('answers in each language', () => {
    expect(b.get().hello).toBe('Hallo');
    setLang('pt-BR');
    expect(b.get().hello).toBe('Olá');
    setLang('en');
    expect(b.get().n(2)).toBe('2 entries');
  });
});
