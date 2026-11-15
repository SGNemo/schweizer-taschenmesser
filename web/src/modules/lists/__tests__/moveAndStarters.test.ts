import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { clearDone, itemRepo, itemsOf, listRepo, moveItem } from '../repo';
import { SECTIONS } from '../schema';
import { createFromStarter, STARTERS, starterItems, starterKind, starterName } from '../templates';

beforeEach(async () => {
  await db.table('lists_list').clear();
  await db.table('lists_item').clear();
});

describe('moving entries and starting from a template (round 2026-11)', () => {
  it('moves an entry to the end of another list and keeps its fields', async () => {
    await listRepo.create({ name: 'Einkauf', kind: 'shopping', order: 0 }, { id: 'shop' });
    await listRepo.create({ name: 'Drogerie', kind: 'shopping', order: 1 }, { id: 'drug' });
    await itemRepo.create({ listId: 'drug', name: 'Seife', done: false, order: 4 });
    const milk = await itemRepo.create({
      listId: 'shop',
      name: 'Zahnpasta',
      done: false,
      order: 0,
      section: 'household',
      priceCents: 199,
    });
    await moveItem(milk.id, 'drug');
    expect(await itemsOf('shop')).toHaveLength(0);
    const moved = (await itemsOf('drug')).map((i) => [i.name, i.order, i.section, i.priceCents]);
    expect(moved).toEqual([
      ['Seife', 4, undefined, undefined],
      ['Zahnpasta', 5, 'household', 199],
    ]);
    // Moving to the same list changes nothing.
    await moveItem(milk.id, 'drug');
    expect((await itemRepo.get(milk.id))?.order).toBe(5);
  });

  it('every starter has a name, a kind and entries', () => {
    for (const id of STARTERS) {
      expect(starterName(id)).not.toBe('');
      expect(starterItems(id).length).toBeGreaterThan(3);
    }
    expect(starterKind('weekly')).toBe('shopping');
    expect(starterKind('vacation')).toBe('packing');
    expect(starterKind('camping')).toBe('packing');
  });

  it('the weekly shop sits in store sections and comes back after shopping', async () => {
    expect(starterItems('weekly').every((i) => SECTIONS.includes(i.section!))).toBe(true);
    const id = await createFromStarter('weekly');
    expect(await listRepo.get(id)).toMatchObject({ name: 'Wocheneinkauf', kind: 'shopping' });
    const items = await itemsOf(id);
    expect(items.length).toBe(starterItems('weekly').length);
    for (const i of items) await itemRepo.update(i.id, { done: true });
    await clearDone(id);
    // Recurring: unticked, not removed.
    expect((await itemsOf(id)).every((i) => !i.done)).toBe(true);
    expect(await itemsOf(id)).toHaveLength(items.length);
  });

  it('the holiday list is a grouped packing list', async () => {
    const id = await createFromStarter('vacation');
    expect(await listRepo.get(id)).toMatchObject({ name: 'Urlaub', kind: 'packing' });
    const groups = new Set((await itemsOf(id)).map((i) => i.category));
    expect([...groups]).toEqual(['Kleidung', 'Hygiene', 'Dokumente', 'Technik', 'Sonstiges']);
  });
});

describe('shared text', () => {
  it('turns each line into an entry without list marks', async () => {
    const { sharedEntries } = await import('../logic');
    expect(
      sharedEntries('Einkauf:\n- 2 Milch\n• Brot\n\n1. Eier\n[ ] Käse\n[x] Butter\n  * Salz  '),
    ).toEqual(['Einkauf:', '2 Milch', 'Brot', 'Eier', 'Käse', 'Butter', 'Salz']);
    expect(sharedEntries('')).toEqual([]);
    expect(sharedEntries(Array.from({ length: 150 }, (_, i) => `x${i}`).join('\n'))).toHaveLength(
      100,
    );
  });
});
