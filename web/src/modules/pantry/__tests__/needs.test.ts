import { beforeEach, expect, it } from 'vitest';
import { bus } from '@/core/events';
import { db } from '@/core/db/db';
import { itemRepo } from '../repo';
import start, { currentNeeds } from '../services';

beforeEach(async () => {
  for (const name of ['pantry_item', '_settings']) await db.table(name).clear();
});

it('names used-up, low, expired and soon-expiring stock once, in that order', async () => {
  await itemRepo.create({ name: 'Milch', place: 'fridge', count: 0 });
  await itemRepo.create({ name: 'Reis', place: 'pantry', count: 1, minCount: 1 });
  await itemRepo.create({ name: 'Joghurt', place: 'fridge', count: 2, expires: '2026-11-10' });
  await itemRepo.create({ name: 'Käse', place: 'fridge', count: 1, expires: '2026-11-17' });
  await itemRepo.create({ name: 'Nudeln', place: 'pantry', count: 4, expires: '2027-05-01' });
  // Used up and expired: named once, as used up.
  await itemRepo.create({ name: 'Sahne', place: 'fridge', count: 0, expires: '2026-11-01' });
  expect(await currentNeeds('2026-11-15')).toEqual([
    { name: 'Milch', reason: 'empty' },
    { name: 'Reis', reason: 'low' },
    { name: 'Sahne', reason: 'empty' },
    { name: 'Joghurt', reason: 'expired' },
    { name: 'Käse', reason: 'soon' },
  ]);
});

it('answers pantry.needsRequested while it runs and writes nothing', async () => {
  await itemRepo.create({ name: 'Milch', place: 'fridge', count: 0 });
  const stop = start();
  let got: unknown[] = [];
  await bus.emit('pantry.needsRequested', { answer: (n) => (got = n) });
  stop();
  expect(got).toEqual([{ name: 'Milch', reason: 'empty' }]);
  expect(await itemRepo.active().count()).toBe(1);
  got = [];
  await bus.emit('pantry.needsRequested', { answer: (n) => (got = n) });
  expect(got).toEqual([]);
});
