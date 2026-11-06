// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineBundle } from './bundle';
import { catalogChain, loadCatalog, provideCatalog } from './catalogs';
import {
  ACTIVE_LOCALES,
  FROZEN_LOCALES,
  LANG_NAMES,
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
const text = localize(source, () => (getLang() === 'en' ? [en] : []));
/** A partial catalog in front of English: the lookup chain itself does not depend on a language. */
const partial = { title: 'Titre', kinds: { a: 'Premier' } };
const chained = localize(source, () => [partial, en]);

describe('language preference', () => {
  beforeEach(() => {
    localStorage.clear();
    setLang('de');
  });
  afterEach(() => vi.restoreAllMocks());

  it('offers German and English only; es, fr, pt-BR are frozen', () => {
    expect(ACTIVE_LOCALES).toEqual(['de', 'en']);
    expect(FROZEN_LOCALES).toEqual(['es', 'fr', 'pt-BR']);
    expect(Object.keys(LANG_NAMES)).toEqual(['de', 'en']);
  });

  it('matches device languages to the active ones, English otherwise', () => {
    expect(matchLang(['de-CH'])).toBe('de');
    expect(matchLang(['en-AU'])).toBe('en');
    expect(matchLang(['ja', 'de-AT'])).toBe('de');
    // Frozen languages are not matched any more: those devices get English.
    expect(matchLang(['pt-PT'])).toBe('en');
    expect(matchLang(['pt-BR', 'de'])).toBe('de');
    expect(matchLang(['fr-CA'])).toBe('en');
    expect(matchLang(['ja', 'es-MX'])).toBe('en');
    expect(matchLang(['ja', 'ko'])).toBe('en');
    expect(matchLang([])).toBe('en');
  });

  it('"system" follows the device language', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE', 'en']);
    expect(resolveLang('system')).toBe('de');
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-ES', 'en']);
    expect(resolveLang('system')).toBe('en');
  });

  it('stores the choice and ignores unknown values', async () => {
    await setLangPref('en');
    expect(readLangPref()).toBe('en');
    expect(getLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    localStorage.setItem('tm-lang', 'xx');
    expect(readLangPref()).toBe('system');
  });

  it.each(FROZEN_LOCALES)('migrates a stored frozen choice (%s) to English, quietly', (frozen) => {
    localStorage.setItem('tm-lang', frozen);
    expect(readLangPref()).toBe('en');
    expect(localStorage.getItem('tm-lang')).toBe('en');
  });

  it('starts in English (never German, never a blank choice) after the old choice was French', async () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);
    const loaded: string[] = [];
    setLangLoader(async (lang) => void loaded.push(lang));
    try {
      localStorage.setItem('tm-lang', 'fr');
      // initLang reads what is stored now, as a fresh start does.
      await initLang(async () => true);
      expect(getLang()).toBe('en');
      expect(getLangPref()).toBe('en');
      expect(loaded).toEqual(['en']);
      expect(localStorage.getItem('tm-lang')).toBe('en');
    } finally {
      setLangLoader(loadCatalog);
    }
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
    setLang('en');
    setLangLoader(() => Promise.reject(new Error('chunk missing')));
    try {
      await initLang(async () => true);
      expect(getLang()).toBe('de');
      expect(getLangPref()).toBe('en'); // the choice stays for the next start
    } finally {
      setLangLoader(loadCatalog);
    }
  });

  it('follows a switch made in another tab (X38)', async () => {
    const loaded: string[] = [];
    setLangLoader(async (lang) => void loaded.push(lang));
    try {
      const other = (key: string | null, newValue: string | null) =>
        window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
      localStorage.setItem('tm-lang', 'en');
      other('tm-lang', 'en');
      await vi.waitFor(() => expect(getLang()).toBe('en'));
      expect(getLangPref()).toBe('en');
      expect(loaded).toEqual(['en']);
      expect(document.documentElement.lang).toBe('en');
      // Other keys and a cleared storage leave the language alone.
      other('tm-format', 'en-US');
      other(null, null);
      await Promise.resolve();
      expect(getLang()).toBe('en');
      // A tab still on an older version writes a frozen language: this one stays on English.
      setLang('de');
      other('tm-lang', 'es');
      await vi.waitFor(() => expect(getLang()).toBe('en'));
      expect(loaded).toEqual(['en', 'en']);
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

  it('falls back along the chain: own catalog, English, then German', () => {
    expect(chained.title).toBe('Titre');
    expect(chained.kinds.a).toBe('Premier');
    expect(chained.kinds.b).toBe('Second');
    expect(chained.count(1)).toBe('1 entry');
    const enOnly = localize(source, () => [{ title: 'Title' }]);
    expect(enOnly.deep.only).toBe('nur Deutsch');
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
    provideCatalog('en', { x: 1 });
    setLang('en');
    expect(catalogChain()).toEqual([{ x: 1 }]);
  });
});

describe('bundles', () => {
  beforeEach(() => setLang('de'));

  it('answers in each active language and keeps frozen texts unused', () => {
    expect(b.get().hello).toBe('Hallo');
    setLang('en');
    expect(b.get().n(2)).toBe('2 entries');
    // Kept in the repo, never served.
    expect((b as { 'pt-BR'?: { hello: string } })['pt-BR']?.hello).toBe('Olá');
  });

  it('needs no frozen language in a new bundle', () => {
    const fresh = defineBundle({ a: 'A' }, { en: { a: 'A (en)' } });
    setLang('en');
    expect(fresh.get().a).toBe('A (en)');
  });
});

describe('quotation marks', () => {
  it('follow the UI language', async () => {
    const { quoted } = await import('./format');
    expect(quoted('x', 'de')).toBe('„x“');
    expect(quoted('x', 'en')).toBe('“x”');
  });
});
