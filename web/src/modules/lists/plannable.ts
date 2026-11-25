/**
 * Lists as a source of the planner (`contributions.plannable`, docs/design/planner-hub/CONCEPT-SOURCES.md §3.1,
 * §3.2 row 2): ONE thing per list, never one per entry.
 *
 *  - A packing list with a trip date whose day before lies inside the planned days → „Packen: <Name>“, 20
 *    minutes, hard due = the day before the trip (today when the trip starts today). By itself: it has a date.
 *  - A shopping list (or a packing list without such a date) only when the person asked it into the plan
 *    (`ctx.requested`, „In den Plan“ on the list): „Einkaufen · 7 Dinge“, 45 minutes. A shopping list is never
 *    empty for long, so it never enters by itself.
 *
 * A list with nothing open is not listed: it leaves the plan when the last entry is ticked. No tick and no
 * write-back (`onDone`, `onAssign` absent): done is the list's own entries; the row's action is „Zur Liste“.
 * Durations are constants the person can override in the plan. Switch: `showInPlan`.
 */
import { addDays } from '@/core/plan/dates';
import { STEPS_MAX, type PlannableItem, type PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { itemRepo, itemsOf, listRepo } from './repo';
import { SHOPPING_LIST_ID } from './schema';
import { settings } from './settings';

export const SHOP_MINUTES = 45;
export const PACK_MINUTES = 20;

const source: PlannableSource = {
  async list(ctx) {
    const prefs = await getSettings('module.lists', settings.schema, settings.defaults);
    if (!prefs.showInPlan) return [];
    const asked = new Set(ctx.requested ?? []);
    const items: PlannableItem[] = [];
    for (const l of await listRepo.active().toArray()) {
      if (l.kind !== 'shopping' && l.kind !== 'packing') continue;
      // An archived list is put away: never a row of the plan, even while a request for it stands.
      if (l.archived) continue;
      // The trip is still ahead (or today) and its day before is one of the planned days.
      const packBy =
        l.kind === 'packing' && l.tripDate && l.tripDate >= ctx.today
          ? addDays(l.tripDate, -1)
          : undefined;
      const dated = packBy !== undefined && packBy <= ctx.until;
      if (!dated && !asked.has(l.id)) continue;
      const all = await itemsOf(l.id);
      const open = all.filter((i) => !i.done).length;
      if (open === 0) continue;
      const to = `/lists?open=${encodeURIComponent(l.id)}`;
      items.push({
        id: l.id,
        kind: l.kind,
        title: l.kind === 'packing' ? t.lists.plan.packing(l.name) : t.lists.plan.shopping(open),
        // A second shopping list says which one it is; the default one is simply „Einkaufen“.
        ...(l.kind === 'shopping' && l.id !== SHOPPING_LIST_ID ? { detail: l.name } : {}),
        to,
        action: { label: t.lists.plan.toList, to },
        durationMin: l.kind === 'packing' ? PACK_MINUTES : SHOP_MINUTES,
        ...(packBy ? { due: { date: packBy < ctx.today ? ctx.today : packBy, hard: true } } : {}),
        // Its entries as steps (package 5a): ticked ones stay in place, so the order never jumps.
        // (by the entries' own order – the list view puts bought ones last, a step list must not jump).
        steps: [...all]
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          .slice(0, STEPS_MAX)
          .map((i) => ({ id: i.id, title: i.name, done: !!i.done })),
        createdAt: l.createdAt,
      });
    }
    return items;
  },
};

/** A list entry ticked from the plan (package 5a): only an entry of that list, read fresh. */
source.onStepDone = async (listId, itemId, done) => {
  const item = await itemRepo.get(itemId);
  if (!item || item.listId !== listId || !!item.done === done) return;
  await itemRepo.update(itemId, { done });
};

export default source;
