import { describe, expect, it } from 'vitest';
import { checkCatalog } from '../../scripts/lib/i18nCheck';
import { de } from '@/strings';
import { en } from './locales/en';
import { ACTIVE_LOCALES, type Lang } from '@/core/i18n/lang';
import sameAsSource from './same-as-source.json';

/**
 * Every active catalog has every text of the German source, nothing extra, no empty or untranslated
 * sentences, and every text function keeps the values it is given. Part of `npm run check:i18n`.
 * Frozen languages (es, fr, pt-BR) are not checked: docs/i18n/FROZEN.md.
 */
const catalogs: Record<Exclude<Lang, 'de'>, object> = { en };

it('covers every active language', () => {
  expect(Object.keys(catalogs).sort()).toEqual(ACTIVE_LOCALES.filter((l) => l !== 'de').sort());
});

describe.each(Object.entries(catalogs))('catalog %s', (lang, catalog) => {
  it('matches the German source', () => {
    const allowed = new Set((sameAsSource as Record<string, string[]>)[lang] ?? []);
    const issues = checkCatalog(de, catalog, { sameAllowed: allowed }).map(
      (i) => `${i.path}: ${i.problem}`,
    );
    expect(issues).toEqual([]);
  });
});

describe('checkCatalog', () => {
  const source = {
    title: 'Neuer Eintrag',
    word: 'Status',
    count: (n: number) => (n === 1 ? '1 Eintrag' : `${n} Einträge`),
    greet: (name: string) => `Hallo ${name}`,
    days: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
  };

  it('accepts a complete translation and single words that stay the same', () => {
    const ok = {
      title: 'New entry',
      word: 'Status',
      count: (n: number) => (n === 1 ? '1 entry' : `${n} entries`),
      greet: (name: string) => `Hello ${name}`,
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    };
    expect(checkCatalog(source, ok)).toEqual([]);
  });

  it('reports missing, extra, untranslated and lost placeholders', () => {
    const bad = {
      title: 'Neuer Eintrag',
      count: () => 'entries',
      greet: () => 'Hello',
      days: [],
      extra: 'x',
    };
    const problems = checkCatalog(source, bad).map((i) => `${i.path}: ${i.problem.split(':')[0]}`);
    expect(problems).toEqual(
      expect.arrayContaining([
        'title: untranslated',
        'word: missing',
        'extra: extra key',
        'greet: drops ‹0› for (‹0›)',
        'days: empty list',
      ]),
    );
  });
});
