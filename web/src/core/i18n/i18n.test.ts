// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { defineBundle } from './bundle';
import { getLang, readLang, setLang } from './lang';

const b = defineBundle(
  { hello: 'Hallo', n: (x: number) => `${x} Einträge`, nested: { a: 'A' } },
  { hello: 'Hello', n: (x: number) => `${x} entries`, nested: { a: 'A' } },
);

describe('i18n', () => {
  beforeEach(() => setLang('de'));

  it('defaults to German and switches', () => {
    expect(b.get().hello).toBe('Hallo');
    setLang('en');
    expect(getLang()).toBe('en');
    expect(b.get().n(2)).toBe('2 entries');
    expect(document.documentElement.lang).toBe('en');
  });

  it('persists and ignores invalid stored values', () => {
    setLang('en');
    expect(readLang()).toBe('en');
    localStorage.setItem('tm-lang', 'fr');
    expect(readLang()).toBe('de');
  });
});
