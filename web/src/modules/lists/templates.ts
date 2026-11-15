import { nextOrder, PACKING_TEMPLATES, type PackingTemplate } from './logic';
import { SECTIONS, type Item, type ListKind, type Section } from './schema';
import { itemRepo, listRepo } from './repo';
import { t } from '@/strings';

export type RoutineId = 'morning' | 'evening' | 'week';
export const ROUTINES: readonly RoutineId[] = ['morning', 'evening', 'week'];

/** A routine as a checklist: a list of small, concrete steps that can be ticked off and reset daily. */
export async function createRoutine(id: RoutineId): Promise<string> {
  const tpl = t.lists.routines[id];
  const lists = await listRepo.active().toArray();
  const list = await listRepo.create({
    name: tpl.name,
    kind: 'checklist',
    order: nextOrder(lists),
  });
  await itemRepo.createMany(
    tpl.items.map((name, i) => ({ data: { listId: list.id, name, done: false, order: i + 1 } })),
  );
  return list.id;
}

/** A packing list from one of the ready-made templates (the start-data wizard offers the same ones). */
export async function createPackingFromTemplate(id: PackingTemplate): Promise<string> {
  const tpl = t.onboarding.lists[id];
  const lists = await listRepo.active().toArray();
  const list = await listRepo.create({
    name: tpl.name,
    kind: 'packing',
    ...(tpl.note ? { note: tpl.note } : {}),
    order: nextOrder(lists),
  });
  await itemRepo.createMany(
    tpl.items.map((name, i) => ({ data: { listId: list.id, name, done: false, order: i + 1 } })),
  );
  return list.id;
}

/** Starting points of a new list: the weekly shop, a holiday packing list and the packing templates. */
export const STARTERS = ['weekly', 'vacation', ...PACKING_TEMPLATES] as const;
export type StarterId = (typeof STARTERS)[number];

export const starterKind = (id: StarterId): ListKind => (id === 'weekly' ? 'shopping' : 'packing');

export const starterName = (id: StarterId): string =>
  id === 'weekly' || id === 'vacation' ? t.lists.starters[id].name : t.onboarding.lists[id].name;

/**
 * The entries a starter puts on the new list. The weekly shop comes back every week: its entries are recurring
 * (ticked off, "Erledigtes entfernen" unticks them) and sit in their store sections; the holiday list is grouped.
 */
export function starterItems(id: StarterId): Omit<Item, 'listId' | 'done' | 'order'>[] {
  if (id === 'weekly')
    return t.lists.starters.weekly.items.map((i) => ({
      name: i.name,
      recurring: true,
      ...((SECTIONS as readonly string[]).includes(i.group) ? { section: i.group as Section } : {}),
    }));
  if (id === 'vacation')
    return t.lists.starters.vacation.items.map((i) => ({ name: i.name, category: i.group }));
  return t.onboarding.lists[id].items.map((name) => ({ name }));
}

/** Writes a starter's entries onto a list that was just created. Returns how many were added. */
export async function fillFromStarter(listId: string, id: StarterId): Promise<number> {
  const items = starterItems(id);
  await itemRepo.createMany(
    items.map((data, i) => ({ data: { ...data, listId, done: false, order: i + 1 } })),
  );
  return items.length;
}

/** A new list (at the end of the tab row) started from a starter; returns its id. */
export async function createFromStarter(id: StarterId): Promise<string> {
  const lists = (await listRepo.active().toArray()).filter((l) => !l.archived);
  const list = await listRepo.create({
    name: starterName(id),
    kind: starterKind(id),
    order: nextOrder(lists),
  });
  await fillFromStarter(list.id, id);
  return list.id;
}
