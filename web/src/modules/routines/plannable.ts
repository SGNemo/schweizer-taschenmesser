/**
 * Routines as a source of the planner (`contributions.plannable`): what is due until the planner's horizon,
 * offered from its day on. The date is soft (a routine waits, it is never "missed"); ticked off in the plan is
 * "Erledigt" on the page: next day, next name. An edited estimate is kept as the routine's minutes. A routine
 * switched off for the planner („Im Planer zeigen“) is not offered.
 */
import { notDeleted } from '@/core/db/repo';
import { recordAs } from '@/core/db/recorder';
import { type PlannableItem, type PlannableSource } from '@/core/modules/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import {
  DEFAULT_MINUTES,
  donePatch,
  doneSteps,
  stepsOf,
  toggleStepPatch,
  whoseTurn,
} from './logic';
import { routineRepo } from './repo';

/** `<id>:<due day>` → its parts, split at the last colon. */
export const split = (key: string): { id: string; due: string } => {
  const at = key.lastIndexOf(':');
  return at < 0 ? { id: key, due: '' } : { id: key.slice(0, at), due: key.slice(at + 1) };
};

/**
 * One step of the turn `<id>:<due day>`, read fresh (package 5a): a turn ticked elsewhere meanwhile is over, a step
 * already in that state writes nothing. Its undo flips only this step back (`progress` is one field: see `recordAs`).
 */
export async function setTurnStep(key: string, stepId: string, done: boolean): Promise<void> {
  const { id, due } = split(key);
  const r = await routineRepo.get(id);
  if (!r || r.dueDate !== due || doneSteps(r).has(stepId) === done) return;
  await recordAs(
    () => setTurnStep(key, stepId, !done),
    () => routineRepo.update(id, toggleStepPatch(r, stepId, done)),
  );
}

const source: PlannableSource = {
  async list(ctx) {
    const due = await routineRepo.table
      .where('dueDate')
      .belowOrEqual(ctx.until)
      .filter((r) => notDeleted(r) && r.planner !== false)
      .toArray();
    return due.map((r): PlannableItem => ({
      // One item per turn (`<id>:<due day>`): a pin or "Nicht planen" of this turn never carries over to the next.
      id: `${r.id}:${r.dueDate}`,
      // The row is one turn of the routine: a link from or to it stores the routine.
      entityId: r.id,
      kind: 'routine',
      title: t.routines.planTitle(r.name, whoseTurn(r)),
      to: `/routines?open=${encodeURIComponent(r.id)}`,
      durationMin: r.minutes ?? DEFAULT_MINUTES,
      earliest: r.dueDate > ctx.today ? r.dueDate : ctx.today,
      // The turn's day (planner rethink): shown there without a row; a turn that is due already shows on today.
      day: r.dueDate > ctx.today ? r.dueDate : ctx.today,
      due: { date: r.dueDate > ctx.today ? r.dueDate : ctx.today, hard: false },
      // The steps of the run due now (package 5a): a later turn has none yet.
      ...(stepsOf(r).length && r.dueDate <= ctx.today
        ? {
            steps: stepsOf(r).map((st) => ({
              id: st.id,
              title: st.text,
              done: doneSteps(r).has(st.id),
            })),
          }
        : {}),
      createdAt: r.createdAt,
    }));
  },
  async onDone(key) {
    const { id, due } = split(key);
    const r = await routineRepo.get(id);
    // A turn that was ticked elsewhere meanwhile is over: nothing to do for it.
    if (r && r.dueDate === due) await routineRepo.update(id, donePatch(r, today()));
  },
  onStepDone: setTurnStep,
  async onEstimate(key, minutes) {
    await routineRepo.update(split(key).id, {
      minutes: Math.max(1, Math.min(1440, Math.round(minutes))),
    });
  },
};

export default source;
