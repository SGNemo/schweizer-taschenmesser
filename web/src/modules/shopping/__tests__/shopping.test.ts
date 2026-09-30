import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { isDuplicate, parseEntry, sortItems } from '../logic';
import manifest from '../manifest';
import { clearBought, itemRepo } from '../repo';

beforeEach(async () => {
  await db.table('shopping_item').clear();
});

describe('shopping', () => {
  it('has a valid manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it.each([
    ['Milch', { name: 'Milch' }],
    ['2 Milch', { name: 'Milch', quantity: '2' }],
    ['2x Milch', { name: 'Milch', quantity: '2' }],
    ['500 g Mehl', { name: 'Mehl', quantity: '500 g' }],
    ['1,5 l Wasser', { name: 'Wasser', quantity: '1,5 l' }],
    ['  3   Äpfel ', { name: 'Äpfel', quantity: '3' }],
    ['7up', { name: '7up' }],
    ['24', { name: '24' }],
  ])('parses "%s"', (text, expected) => {
    expect(parseEntry(text)).toEqual(expected);
  });

  it('sorts open items first and detects duplicates', () => {
    const base = { name: 'x', done: false };
    const items = [
      { ...base, name: 'b', done: true, createdAt: 1 },
      { ...base, name: 'c', createdAt: 3 },
      { ...base, name: 'a', createdAt: 2 },
    ];
    expect(sortItems(items).map((i) => i.name)).toEqual(['a', 'c', 'b']);
    expect(isDuplicate(items, ' C ')).toBe(true);
    expect(isDuplicate(items, 'b')).toBe(false); // already bought: may be added again
  });

  it('removes bought items only', async () => {
    await itemRepo.create({ name: 'Brot', done: true });
    await itemRepo.create({ name: 'Käse', done: false });
    expect(await clearBought()).toBe(1);
    expect((await itemRepo.active().toArray()).map((i) => i.name)).toEqual(['Käse']);
  });
});
