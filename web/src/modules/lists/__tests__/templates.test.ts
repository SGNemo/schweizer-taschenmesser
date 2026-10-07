import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { t } from '@/strings';
import { itemRepo, listRepo } from '../repo';
import { ROUTINES, createRoutine } from '../templates';

beforeEach(async () => {
  await db.table('lists_list').clear();
  await db.table('lists_item').clear();
});

describe('routine templates', () => {
  it.each(ROUTINES)('%s becomes a checklist with small, ordered, open steps', async (id) => {
    const listId = await createRoutine(id);
    const list = await listRepo.get(listId);
    expect(list).toMatchObject({ name: t.lists.routines[id].name, kind: 'checklist' });
    const items = (await itemRepo.active().toArray())
      .filter((i) => i.listId === listId)
      .sort((a, b) => a.order - b.order);
    expect(items.map((i) => i.name)).toEqual(t.lists.routines[id].items);
    expect(items.every((i) => !i.done)).toBe(true);
  });

  it('can be created twice without touching the first list', async () => {
    const a = await createRoutine('morning');
    const b = await createRoutine('morning');
    expect(a).not.toBe(b);
    expect(await listRepo.active().count()).toBe(2);
  });
});
