import { nextOrder } from './logic';
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
