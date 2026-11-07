import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '@/core/i18n/catalogs';
import { setLang, type Lang } from '@/core/i18n/lang';
import { t } from '@/strings';
import { dueState, dueTone, pastDay } from './due';

afterEach(() => setLang('de'));

const TODAY = '2026-09-29';

describe('dueTone', () => {
  it('keeps the existing rule', () => {
    expect(dueTone(undefined, false, TODAY)).toBe('none');
    expect(dueTone('2026-09-28', false, TODAY)).toBe('overdue');
    expect(dueTone('2026-09-28', true, TODAY)).toBe('later');
  });
});

describe('dueState', () => {
  it('marks past dates overdue with the day, never a count (N08)', () => {
    expect(dueState('2026-09-26', TODAY)).toMatchObject({
      tone: 'overdue',
      days: -3,
      label: 'war am Sa. fällig',
    });
    expect(dueState('2026-09-28', TODAY).label).toBe('war am Mo. fällig');
    // More than a week back: the date.
    expect(dueState('2026-09-17', TODAY).label).toBe('war am 17. Sep. fällig');
  });
  it('highlights today', () => {
    expect(dueState(TODAY, TODAY)).toMatchObject({ tone: 'today', label: 'Heute' });
  });
  it('treats up to three days as soon and the rest as later', () => {
    expect(dueState('2026-09-30', TODAY)).toMatchObject({ tone: 'soon', label: 'Morgen' });
    expect(dueState('2026-10-02', TODAY)).toMatchObject({ tone: 'soon', label: 'in 3 Tagen' });
    expect(dueState('2026-10-03', TODAY).tone).toBe('later');
    expect(dueState('2026-10-03', TODAY, { soonDays: 5 }).tone).toBe('soon');
  });
  it('never calls finished items overdue', () => {
    expect(dueState('2026-09-20', TODAY, { done: true }).tone).toBe('later');
  });
});

describe('overdue wording in every active language (N08)', () => {
  it.each([
    ['de', 'war am Mo. fällig', 'war am 17. Sep. fällig', 'MHD war Mo.'],
    ['en', 'was due Mon', 'was due 17 Sep', 'best-before was Mon'],
  ] as const)('%s: the day, never a count', async (lang, week, older, pantry) => {
    if (lang !== 'de') await loadCatalog(lang as Lang);
    setLang(lang as Lang);
    const yesterday = dueState('2026-09-28', TODAY).label;
    expect(yesterday).toBe(week);
    expect(dueState('2026-09-17', TODAY).label).toBe(older);
    expect(t.pantry.expiredOn(pastDay('2026-09-28', TODAY))).toBe(pantry);
    expect(`${yesterday} ${older}`).not.toMatch(
      /\d+ (Tagen|days|días|jours|dias)|gestern|yesterday/,
    );
  });
});
