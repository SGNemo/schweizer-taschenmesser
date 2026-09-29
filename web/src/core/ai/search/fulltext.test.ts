import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { setNow } from '@/core/time/now';
import { clearAll, ctxFor, seed, useFixedClock } from '../testing';
import { searchEntries, searchText } from './fulltext';

beforeEach(async () => {
  useFixedClock();
  await clearAll();
  await seed();
});
afterAll(() => setNow());

describe('full text search', () => {
  it('finds entries across modules, ignoring case and diacritics', async () => {
    const hits = await searchEntries('MIETE ueberweisen', ctxFor());
    expect(hits.map((h) => h.title)).toEqual(['Miete überweisen']);
    expect(hits[0]!.subtitle).toBe('Erinnerungen · Erinnerung');
    expect(hits[0]!.to).toBe('/reminders');
  });

  it('matches prefixes and small typos', async () => {
    expect((await searchEntries('stadtw', ctxFor())).map((h) => h.title)).toEqual([
      'Stadtwerke Musterstadt',
    ]);
    expect((await searchEntries('Vodafon', ctxFor())).map((h) => h.title)).toEqual(['Vodafone']);
  });

  it('searches only enabled modules', async () => {
    expect(await searchEntries('Vodafone', ctxFor(['todos']))).toEqual([]);
  });

  it('ignores deleted entries and empty queries', async () => {
    expect(await searchEntries('   ', ctxFor())).toEqual([]);
    expect(await searchEntries('?!', ctxFor())).toEqual([]);
  });

  it('wraps hits as a result', async () => {
    const r = await searchText('Netflix', ctxFor());
    expect(r).toMatchObject({ kind: 'rows', total: 1, heading: 'Treffer für „Netflix“' });
  });
});
