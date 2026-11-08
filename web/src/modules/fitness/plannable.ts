/**
 * Planned sessions as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „Training: Oberkörper · 60 Min“, pinned to the day the user chose (`earliest` = `due`), so the planner
 * fits it into that day and never moves it. Ticked off in the plan = logged (`planned` cleared); an edited
 * estimate becomes the session's duration. Logged sessions are never offered.
 */
import { notDeleted } from '@/core/db/repo';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { t } from '@/strings';
import { sessionTitle } from './data';
import { sessionMinutes } from './logic';
import { sessionRepo } from './repo';

/** A planned session without any duration still takes some time in the plan. */
export const DEFAULT_MINUTES = 45;

const source: PlannableSource = {
  async list(ctx) {
    const planned = await sessionRepo.table
      .where('date')
      .between(ctx.today, ctx.until, true, true)
      .filter((s) => notDeleted(s) && s.planned === true)
      .toArray();
    return planned.map((s): PlannableItem => ({
      id: s.id,
      kind: 'training',
      title: t.fitness.calendar.session(sessionTitle(s)),
      to: `/fitness?open=${encodeURIComponent(s.id)}`,
      durationMin: sessionMinutes(s) || DEFAULT_MINUTES,
      earliest: s.date,
      due: { date: s.date, hard: true },
      createdAt: s.createdAt,
    }));
  },
  async onDone(id) {
    await sessionRepo.update(id, { planned: undefined });
  },
  async onEstimate(id, minutes) {
    await sessionRepo.update(id, { durationMin: Math.max(1, Math.min(1440, Math.round(minutes))) });
  },
};

export default source;
