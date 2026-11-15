/**
 * The Merkliste as a source of the planner (`contributions.plannable`): only what the person marked with
 * "In den Plan" and has not finished. No date and nothing hard: a Merkzettel is a wish, the planner finds
 * free time for it. Ticked off in the plan is "Erledigt" here; the estimate edited there is kept.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { t } from '@/strings';
import { planMinutesOf } from './logic';
import { itemRepo } from './repo';

export const BOOKMARK_KIND = 'bookmark';

const source: PlannableSource = {
  async list() {
    const marked = (await itemRepo.active().toArray()).filter((i) => i.inPlan && !i.done);
    return marked.map((i): PlannableItem => ({
      id: i.id,
      kind: BOOKMARK_KIND,
      // "Film/Serie: Dune"; a plain link or "Sonstiges" says nothing about what to do, so only its title.
      title: t.bookmarks.planTitle(
        i.kind === 'link' || i.kind === 'other' ? '' : (t.bookmarks.kinds[i.kind] ?? ''),
        i.title,
      ),
      to: `/bookmarks?open=${encodeURIComponent(i.id)}`,
      durationMin: planMinutesOf(i),
      createdAt: i.createdAt,
    }));
  },
  async onDone(id) {
    const item = await itemRepo.get(id);
    if (item && !item.done) await itemRepo.update(id, { done: true, started: false });
  },
  async onEstimate(id, minutes) {
    if (await itemRepo.get(id))
      await itemRepo.update(id, { planMinutes: Math.max(1, Math.min(1440, Math.round(minutes))) });
  },
};

export default source;
