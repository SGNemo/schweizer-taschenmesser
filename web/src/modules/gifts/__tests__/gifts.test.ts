import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import calendar from '../calendar';
import { applyFilter, groupByPerson, safeUrl, totals } from '../logic';
import manifest from '../manifest';
import { ideaRepo } from '../repo';
import { ideaSchema, type Idea } from '../schema';

const idea = (o: Partial<Idea> = {}): Idea =>
  ideaSchema.parse({ title: 'Buch', forWhom: 'Anna', ...o });

beforeEach(async () => {
  await db.table('gifts_idea').clear();
});

describe('gifts module', () => {
  it('has a valid manifest, is off by default and gives the assistant nothing', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.aiSchema).toBeUndefined();
    expect(manifest.dataSchema.collections.idea?.dataApi).not.toBe(false);
  });
  it('validates ideas', () => {
    expect(ideaSchema.safeParse({ title: '', forWhom: 'x' }).success).toBe(false);
    expect(ideaSchema.safeParse({ title: 'x', forWhom: '' }).success).toBe(false);
    expect(ideaSchema.safeParse({ title: 'x', forWhom: 'y', priceCents: -1 }).success).toBe(false);
    expect(ideaSchema.safeParse({ title: 'x', forWhom: 'y', priceCents: 12.5 }).success).toBe(
      false,
    );
    expect(ideaSchema.safeParse({ title: 'x', forWhom: 'y', date: '24.12.2026' }).success).toBe(
      false,
    );
    expect(idea().status).toBe('idea');
  });
});

describe('safeUrl', () => {
  it('keeps web links only', () => {
    expect(safeUrl('example.org/buch')).toBe('https://example.org/buch');
    expect(safeUrl(' http://example.org ')).toBe('http://example.org/');
    expect(safeUrl('')).toBeUndefined();
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,x')).toBeUndefined();
    expect(safeUrl('mailto:a@b.de')).toBeUndefined();
    expect(safeUrl('http://')).toBeUndefined();
  });
});

describe('grouping, filtering and totals', () => {
  const list = [
    idea({ title: 'Z', forWhom: 'Bernd', status: 'given', priceCents: 1000 }),
    idea({ title: 'B', forWhom: 'anna', date: '2026-12-24' }),
    idea({ title: 'A', forWhom: 'anna', date: '2026-12-01' }),
    idea({ title: 'C', forWhom: 'anna', status: 'bought', priceCents: 2550 }),
    idea({ title: 'Ö', forWhom: 'Ömer' }),
  ];
  it('sorts people A–Z and puts open ideas first, by date then title', () => {
    const groups = groupByPerson(list);
    expect(groups.map((g) => g.person)).toEqual(['anna', 'Bernd', 'Ömer']);
    expect(groups[0]!.ideas.map((i) => i.title)).toEqual(['A', 'B', 'C']);
  });
  it('filters by status', () => {
    expect(applyFilter(list, 'all')).toHaveLength(5);
    expect(
      applyFilter(list, 'idea')
        .map((i) => i.title)
        .sort(),
    ).toEqual(['A', 'B', 'Ö']);
    expect(applyFilter(list, 'bought')).toHaveLength(1);
    expect(applyFilter(list, 'given')).toHaveLength(1);
  });
  it('counts and sums what was bought or given', () => {
    expect(totals(list)).toEqual({ open: 3, bought: 1, given: 1, spentCents: 3550 });
    expect(totals([])).toEqual({ open: 0, bought: 0, given: 0, spentCents: 0 });
  });
});

describe('calendar', () => {
  it('shows occasions until the gift is given', async () => {
    await ideaRepo.create(idea({ title: 'Buch', forWhom: 'Anna', date: '2026-12-24' }));
    await ideaRepo.create(
      idea({ title: 'Schal', forWhom: 'Bernd', date: '2026-12-25', status: 'given' }),
    );
    await ideaRepo.create(idea({ title: 'Ohne Datum' }));
    const items = await calendar({ from: '2026-12-01', to: '2026-12-31' });
    expect(items.map((i) => i.title)).toEqual(['Geschenk für Anna: Buch']);
    expect(items[0]).toMatchObject({ date: '2026-12-24', allDay: true, source: 'gifts' });
  });
});
