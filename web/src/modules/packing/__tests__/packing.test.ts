import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { validateManifest } from '@/core/modules/registry';
import { copyName, nextOrder, progress, sortItems } from '../logic';
import manifest from '../manifest';
import { deleteList, duplicateList, itemRepo, listRepo, resetList } from '../repo';

beforeEach(async () => {
  await db.table('packing_list').clear();
  await db.table('packing_item').clear();
});

describe('packing logic', () => {
  it('reports progress', () => {
    expect(progress([])).toEqual({ packed: 0, total: 0, complete: false });
    expect(progress([{ packed: true }, { packed: false }])).toEqual({
      packed: 1,
      total: 2,
      complete: false,
    });
    expect(progress([{ packed: true }])).toMatchObject({ complete: true });
  });

  it('sorts open items first in list order', () => {
    const base = { listId: 'l', name: '', packed: false, order: 0, createdAt: 0 };
    const sorted = sortItems([
      { ...base, name: 'gepackt', packed: true, order: 0 },
      { ...base, name: 'b', order: 2 },
      { ...base, name: 'a', order: 1 },
    ]);
    expect(sorted.map((i) => i.name)).toEqual(['a', 'b', 'gepackt']);
    expect(nextOrder(sorted)).toBe(3);
    expect(nextOrder([])).toBe(0);
  });

  it('names copies uniquely', () => {
    expect(copyName('Sommerurlaub', [])).toBe('Kopie von Sommerurlaub');
    expect(copyName('Sommerurlaub', ['Kopie von Sommerurlaub'])).toBe('Kopie von Sommerurlaub (2)');
    expect(copyName('X', ['Kopie von X', 'Kopie von X (2)'])).toBe('Kopie von X (3)');
  });
});

describe('packing module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  async function trip() {
    const list = await listRepo.create({ name: 'Urlaub', note: 'Nordsee' });
    for (const [i, name] of ['Zahnbürste', 'Ladekabel', 'Sonnencreme'].entries()) {
      await itemRepo.create({ listId: list.id, name, packed: i < 2, order: i });
    }
    return list;
  }

  it('resets a list to unpacked', async () => {
    const list = await trip();
    await resetList(list.id);
    expect((await itemRepo.active().toArray()).every((i) => !i.packed)).toBe(true);
  });

  it('duplicates a list as an unpacked template without touching the original', async () => {
    const list = await trip();
    const copyId = await duplicateList(list.id);
    const copy = await listRepo.get(copyId);
    expect(copy).toMatchObject({ name: 'Kopie von Urlaub', note: 'Nordsee' });
    const copied = (await itemRepo.active().toArray()).filter((i) => i.listId === copyId);
    expect(copied.map((i) => i.name).sort()).toEqual(['Ladekabel', 'Sonnencreme', 'Zahnbürste']);
    expect(copied.every((i) => !i.packed)).toBe(true);
    const original = (await itemRepo.active().toArray()).filter((i) => i.listId === list.id);
    expect(original.filter((i) => i.packed)).toHaveLength(2);
    expect(await duplicateList(list.id).then((id) => listRepo.get(id))).toMatchObject({
      name: 'Kopie von Urlaub (2)',
    });
  });

  it('deleting a list removes only its items', async () => {
    const list = await trip();
    const other = await listRepo.create({ name: 'Wandern' });
    await itemRepo.create({ listId: other.id, name: 'Stöcke', packed: false, order: 0 });
    await deleteList(list.id);
    expect((await listRepo.active().toArray()).map((l) => l.name)).toEqual(['Wandern']);
    expect((await itemRepo.active().toArray()).map((i) => i.name)).toEqual(['Stöcke']);
  });
});
