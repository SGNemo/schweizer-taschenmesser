import { describe, expect, it } from 'vitest';
import { lastPlace, matchesQuery, viewPlaces } from '../placesView';

const p = (name: string, over: Record<string, unknown> = {}) =>
  ({ name, category: 'other', pinned: false, createdAt: 1, ...over }) as never;

describe('placesView', () => {
  it('matches all words in name, address or note', () => {
    expect(matchesQuery({ name: 'Büro', address: 'Südgelände, Erlangen' }, 'büro erlangen')).toBe(
      true,
    );
    expect(matchesQuery({ name: 'Büro', address: 'Südgelände' }, 'büro nürnberg')).toBe(false);
    expect(matchesQuery({ name: 'X', note: 'Parkplatz hinten' }, 'PARKPLATZ')).toBe(true);
    expect(matchesQuery({ name: 'X' }, '   ')).toBe(true);
  });

  it('filters by category and puts pinned first, newest first by default', () => {
    const list = [
      p('Alt', { createdAt: 1, category: 'shop' }),
      p('Neu', { createdAt: 5, category: 'shop' }),
      p('Fest', { createdAt: 2, category: 'shop', pinned: true }),
      p('Arzt', { createdAt: 9, category: 'health' }),
    ];
    expect(viewPlaces(list, { category: 'shop' }).map((x: { name: string }) => x.name)).toEqual([
      'Fest',
      'Neu',
      'Alt',
    ]);
    expect(
      viewPlaces(list, { category: 'all', sort: 'name' }).map((x: { name: string }) => x.name),
    ).toEqual(['Fest', 'Alt', 'Arzt', 'Neu']);
  });

  it('names the place saved last', () => {
    expect(
      lastPlace([
        { createdAt: 3, n: 'a' },
        { createdAt: 7, n: 'b' },
      ])?.n,
    ).toBe('b');
    expect(lastPlace([])).toBeUndefined();
  });
});
