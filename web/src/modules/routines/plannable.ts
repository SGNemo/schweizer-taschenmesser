/**
 * Routines as a source of the planner (`contributions.plannable`): what is due until the planner's horizon,
 * offered from its day on. The date is soft (a routine waits, it is never "missed"); ticked off in the plan is
 * "Erledigt" on the page: next day, next name. An edited estimate is kept as the routine's minutes.
 */
import { notDeleted } from '@/core/db/repo';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { DEFAULT_MINUTES, donePatch, whoseTurn } from './logic';
import { routineRepo } from './repo';

/** `<id>:<due day>` → its parts, split at the last colon. */
const split = (key: string): { id: string; due: string } => {
  const at = key.lastIndexOf(':');
  return at < 0 ? { id: key, due: '' } : { id: key.slice(0, at), due: key.slice(at + 1) };
};

const source: PlannableSource = {
  async list(ctx) {
    const due = await routineRepo.table
      .where('dueDate')
      .belowOrEqual(ctx.until)
      .filter(notDeleted)
      .toArray();
    return due.map((r): PlannableItem => ({
      // One item per turn (`<id>:<due day>`): a pin or "Nicht planen" of this turn never carries over to the next.
      id: `${r.id}:${r.dueDate}`,
      kind: 'routine',
      title: t.routines.planTitle(r.name, whoseTurn(r)),
      to: `/routines?open=${encodeURIComponent(r.id)}`,
      durationMin: r.minutes ?? DEFAULT_MINUTES,
      earliest: r.dueDate > ctx.today ? r.dueDate : ctx.today,
      due: { date: r.dueDate > ctx.today ? r.dueDate : ctx.today, hard: false },
      createdAt: r.createdAt,
    }));
  },
  async onDone(key) {
    const { id, due } = split(key);
    const r = await routineRepo.get(id);
    // A turn that was ticked elsewhere meanwhile is over: nothing to do for it.
    if (r && r.dueDate === due) await routineRepo.update(id, donePatch(r, today()));
  },
  async onEstimate(key, minutes) {
    await routineRepo.update(split(key).id, {
      minutes: Math.max(1, Math.min(1440, Math.round(minutes))),
    });
  },
};

export default source;
