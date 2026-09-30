import { beforeEach, describe, expect, it } from 'vitest';
import { bus } from '@/core/events';
import { db } from '@/core/db/db';
import { itemRepo } from '../repo';
import start, { addRequested } from '../services';

beforeEach(async () => {
  await db.table('shopping_item').clear();
});

/** The pantry (and any other module) asks for items through `shopping.requested`. */
describe('shopping requests', () => {
  it('adds a requested item once and ignores blank names', async () => {
    await addRequested({ name: ' Milch ' });
    await addRequested({ name: 'milch' });
    await addRequested({ name: '   ' });
    expect((await itemRepo.active().toArray()).map((i) => i.name)).toEqual(['Milch']);
  });

  it('can add an item again once the earlier one was bought', async () => {
    await itemRepo.create({ name: 'Milch', done: true });
    await addRequested({ name: 'Milch' });
    expect(await itemRepo.active().count()).toBe(2);
  });

  it('is reachable through the event bus while the service runs, and only then', async () => {
    const stop = start();
    await bus.emit('shopping.requested', { name: 'Butter', quantity: ' 2 ' });
    stop();
    await bus.emit('shopping.requested', { name: 'Käse' });
    expect((await itemRepo.active().toArray()).map((i) => [i.name, i.quantity])).toEqual([
      ['Butter', '2'],
    ]);
  });
});
