import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { applyFilter, daysLeft, expiryState, needsRestock, parseCount, sortItems } from '../logic';
import manifest from '../manifest';
import { itemRepo } from '../repo';
import { itemSchema, type PantryItem } from '../schema';
import notifications from '../notifications';
import calendar from '../calendar';

const TODAY = '2026-09-29';
const item = (o: Partial<PantryItem> = {}): PantryItem => itemSchema.parse({ name: 'Milch', ...o });

beforeEach(async () => {
  await db.table('pantry_item').clear();
  setNow(() => new Date('2026-09-29T10:00:00').getTime());
});

describe('pantry module', () => {
  it('has a valid manifest, is off by default and offers the assistant only names and dates', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.aiSchema?.collections.item?.fields).not.toHaveProperty('note');
  });

  it('validates items and fills defaults', () => {
    expect(itemSchema.safeParse({ name: '' }).success).toBe(false);
    expect(itemSchema.safeParse({ name: 'x', count: -1 }).success).toBe(false);
    expect(itemSchema.safeParse({ name: 'x', expires: '29.09.2026' }).success).toBe(false);
    expect(item()).toMatchObject({ place: 'pantry', count: 1 });
  });
});

describe('expiry', () => {
  it('counts days and classifies', () => {
    expect(daysLeft(item({ expires: '2026-10-02' }), TODAY)).toBe(3);
    expect(daysLeft(item(), TODAY)).toBeUndefined();
    expect(expiryState(item({ expires: '2026-09-28' }), TODAY, 3)).toBe('expired');
    expect(expiryState(item({ expires: '2026-09-29' }), TODAY, 3)).toBe('soon');
    expect(expiryState(item({ expires: '2026-10-02' }), TODAY, 3)).toBe('soon');
    expect(expiryState(item({ expires: '2026-10-03' }), TODAY, 3)).toBe('ok');
    expect(expiryState(item(), TODAY, 3)).toBe('none');
  });
  it('never flags an empty stock (nothing left to spoil)', () => {
    expect(expiryState(item({ expires: '2020-01-01', count: 0 }), TODAY, 3)).toBe('none');
  });
  it('sorts expired first, then by date, then by name', () => {
    const list = [
      item({ name: 'C', expires: '2026-12-01' }),
      item({ name: 'B' }),
      item({ name: 'A', expires: '2026-09-01' }),
      item({ name: 'D', expires: '2026-09-30' }),
      item({ name: 'Ä' }),
    ];
    expect(sortItems(list, TODAY, 3).map((i) => i.name)).toEqual(['A', 'D', 'C', 'Ä', 'B']);
  });
  it('filters', () => {
    const list = [
      item({ name: 'a', expires: '2026-09-30' }),
      item({ name: 'b', minCount: 1, count: 1 }),
      item({ name: 'c', count: 4 }),
    ];
    expect(applyFilter(list, 'expiring', TODAY, 3).map((i) => i.name)).toEqual(['a']);
    expect(applyFilter(list, 'restock', TODAY, 3).map((i) => i.name)).toEqual(['b']);
    expect(applyFilter(list, 'all', TODAY, 3)).toHaveLength(3);
  });
});

describe('restock and counts', () => {
  it('needs restock at or below the minimum, or at zero without one', () => {
    expect(needsRestock(item({ count: 2, minCount: 2 }))).toBe(true);
    expect(needsRestock(item({ count: 3, minCount: 2 }))).toBe(false);
    expect(needsRestock(item({ count: 0 }))).toBe(true);
    expect(needsRestock(item({ count: 1 }))).toBe(false);
  });
  it('parses whole counts only', () => {
    expect(parseCount('3')).toBe(3);
    expect(parseCount(' 12 ')).toBe(12);
    for (const bad of ['', '-1', '1,5', 'x', '12345']) expect(parseCount(bad)).toBeUndefined();
  });
});

describe('calendar and reminders', () => {
  it('puts best-before dates of stocked items on the calendar', async () => {
    await itemRepo.create(item({ name: 'Joghurt', expires: '2026-10-05' }));
    await itemRepo.create(item({ name: 'Leer', expires: '2026-10-05', count: 0 }));
    await itemRepo.create(item({ name: 'Später', expires: '2026-12-05' }));
    const items = await calendar({ from: '2026-10-01', to: '2026-10-31' });
    expect(items.map((i) => i.title)).toEqual(['Läuft bald ab: Joghurt']);
    expect(items[0]).toMatchObject({ date: '2026-10-05', allDay: true, source: 'pantry' });
  });
  it('reminds one day before at 18:00 by default, once, only for stocked items', async () => {
    await itemRepo.create(item({ name: 'Joghurt', expires: '2026-10-05' }));
    await itemRepo.create(item({ name: 'Leer', expires: '2026-10-05', count: 0 }));
    const from = new Date('2026-10-01T00:00:00').getTime();
    const due = await notifications({ from, to: from + 10 * 86_400_000 });
    expect(due).toHaveLength(1);
    expect(due[0]!.at).toBe(new Date('2026-10-04T18:00:00').getTime());
    expect(due[0]!.key).toMatch(/^pantry:.+:2026-10-05$/);
    expect(await notifications({ from: due[0]!.at, to: due[0]!.at + 1000 })).toHaveLength(0);
  });
});
