import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { itemRepo } from '../repo';
import { piecesOf, restock } from '../services';

beforeEach(async () => {
  await db.table('pantry_item').clear();
});

describe('bought goods go to the pantry', () => {
  it('counts a plain number as pieces and anything else as one', () => {
    expect(piecesOf('3')).toBe(3);
    expect(piecesOf('500 g')).toBe(1);
    expect(piecesOf(undefined)).toBe(1);
    expect(piecesOf('0')).toBe(1);
  });

  it('adds to the item of the same name (ignoring case) and creates unknown ones', async () => {
    await itemRepo.create({ name: 'Milch', place: 'fridge', count: 1 });
    await restock({ name: 'milch', quantity: '2' });
    await restock({ name: 'Reis' });
    const items = (await itemRepo.active().toArray()).sort((a, b) => a.name.localeCompare(b.name));
    expect(items.map((i) => [i.name, i.count, i.place])).toEqual([
      ['Milch', 3, 'fridge'],
      ['Reis', 1, 'pantry'],
    ]);
  });
});
