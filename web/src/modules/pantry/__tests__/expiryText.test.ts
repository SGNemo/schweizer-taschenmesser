import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '@/core/i18n/catalogs';
import { setLang, type Lang } from '@/core/i18n/lang';
import { expiryText } from '../logic';

/** Tuesday 2026-09-29, like `core/time/due.test.ts`. */
const TODAY = '2026-09-29';
const at = (expires: string) => expiryText({ expires }, TODAY, 3);

afterEach(() => setLang('de'));

describe('pantry page: an expired item names its day (N08), in every active language', () => {
  it.each([
    ['de', 'MHD war Mo.', 'MHD war 17. Sep.'],
    ['en', 'Best-before was Mon', 'Best-before was 17 Sep'],
  ] as const)('%s: the day, never a count', async (lang, week, older) => {
    if (lang !== 'de') await loadCatalog(lang as Lang);
    setLang(lang as Lang);
    expect(at('2026-09-28')).toBe(week);
    expect(at('2026-09-17')).toBe(older);
    // A count that grows every day is gone (FOCUS-GUIDELINES text rules).
    expect(`${at('2026-09-28')} ${at('2026-09-17')}`).not.toMatch(
      /\d+ (Tagen|days|días|jours|dias)|gestern|yesterday|ayer|hier|ontem/i,
    );
  });

  it('today, soon, later and no date keep their lines', () => {
    expect(at(TODAY)).toBe('Läuft heute ab');
    expect(at('2026-09-30')).toBe('Läuft morgen ab');
    expect(at('2026-10-20')).toBe('Haltbar bis 20.10.2026');
    expect(expiryText({}, TODAY, 3)).toBeNull();
  });
});
