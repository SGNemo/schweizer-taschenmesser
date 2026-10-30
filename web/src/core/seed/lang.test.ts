import { describe, expect, it } from 'vitest';
import { LANGS } from '@/core/i18n/lang';
import bookmarks from '@/modules/bookmarks/seed';
import budgets from '@/modules/budgets/seed';
import invoices from '@/modules/invoices/seed';
import lists from '@/modules/lists/seed';
import notes from '@/modules/notes/seed';
import pantry from '@/modules/pantry/seed';
import subscriptions from '@/modules/subscriptions/seed';
import todos from '@/modules/todos/seed';
import { createSeedContext } from './context';

const texts = (rows: Record<string, { data: Record<string, unknown> }[]>) =>
  Object.values(rows)
    .flat()
    .flatMap((r) => Object.values(r.data))
    .filter((v): v is string => typeof v === 'string');

describe('localized seed text', () => {
  it('text() falls back to German for a missing language', () => {
    const ctx = createSeedContext({
      moduleId: 'x',
      today: '2026-09-29',
      scale: 'small',
      lang: 'fr',
    });
    expect(ctx.text({ de: 'Hallo', en: 'Hello' })).toBe('Hallo');
    expect(ctx.text({ de: 'Hallo', fr: 'Salut' })).toBe('Salut');
  });

  it.each([
    ['notes', notes],
    ['pantry', pantry],
    ['lists', lists],
    ['todos', todos],
    ['bookmarks', bookmarks],
    ['subscriptions', subscriptions],
    ['budgets', budgets],
    ['invoices', invoices],
  ])('%s: every language has its own text and the same row ids', (id, mod) => {
    const make = (lang: (typeof LANGS)[number]) =>
      mod.seed(createSeedContext({ moduleId: id, today: '2026-09-29', scale: 'medium', lang }));
    const de = make('de');
    const ids = (r: typeof de) =>
      Object.values(r)
        .flat()
        .map((x) => x.id);
    for (const lang of LANGS.filter((l) => l !== 'de')) {
      const other = make(lang);
      expect(ids(other)).toEqual(ids(de));
      expect(texts(other)).not.toEqual(texts(de));
    }
  });
});
