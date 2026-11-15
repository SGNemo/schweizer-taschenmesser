/**
 * Planned sessions as a source of the planner (`contributions.plannable`, docs/design/plan/CONCEPT.md §4):
 * „Training: Oberkörper · 60 Min“, pinned to the day the user chose (`earliest` = `due`), so the planner
 * fits it into that day and never moves it. A session with a time is a fixed block (planner hub S4, `fixed`):
 * it stands at its time on its day, takes that stretch and is never late – so it carries no deadline. Ticked off in the plan = logged (`planned` cleared); an edited
 * estimate becomes the session's duration. Logged sessions are never offered.
 *
 * Deep package 3: the training plan's days (a template on its weekdays) come along as items of their own,
 * `plan:<templateId>:<date>`, derived and never stored; a day that has any session already offers none.
 * Ticked off = a logged session from the template, today.
 */
import { notDeleted } from '@/core/db/repo';
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { today } from '@/core/time/dates';
import { t } from '@/strings';
import { sessionTitle } from './data';
import { doneToday, sessionMinutes } from './logic';
import { parsePlanItemId, planDays, planItemId, sessionFromTemplate } from './plan';
import { sessionRepo, templateRepo } from './repo';

/** A planned session without any duration still takes some time in the plan. */
export const DEFAULT_MINUTES = 45;

const source: PlannableSource = {
  async list(ctx) {
    const planned = await sessionRepo.table
      .where('date')
      .between(ctx.today, ctx.until, true, true)
      .filter((s) => notDeleted(s) && s.planned === true)
      .toArray();
    const templates = (await templateRepo.active().toArray()).filter((x) => x.weekdays?.length);
    const busy = templates.length
      ? (
          await sessionRepo.table.where('date').between(ctx.today, ctx.until, true, true).toArray()
        ).filter(notDeleted)
      : [];
    const plan = planDays(templates, busy, ctx.today, ctx.until).map(
      ({ date, template }): PlannableItem => ({
        id: planItemId(template.id, date),
        kind: 'training',
        title: t.fitness.calendar.session(template.title),
        to: '/fitness',
        durationMin: template.durationMin ?? DEFAULT_MINUTES,
        earliest: date,
        due: { date, hard: true },
        createdAt: template.createdAt,
      }),
    );
    return [
      ...planned.map((s): PlannableItem => ({
        id: s.id,
        kind: 'training',
        title: t.fitness.calendar.session(sessionTitle(s)),
        to: `/fitness?open=${encodeURIComponent(s.id)}`,
        durationMin: sessionMinutes(s) || DEFAULT_MINUTES,
        earliest: s.date,
        // With a time: from there for its minutes (the planner ends it), on its day only.
        ...(s.time ? { fixed: { from: s.time } } : { due: { date: s.date, hard: true } }),
        createdAt: s.createdAt,
      })),
      ...plan,
    ];
  },
  async onDone(id) {
    const plan = parsePlanItemId(id);
    if (plan) {
      // A later plan day cannot be done today: nothing is logged (the day stays in the plan).
      if (plan.date > today()) return;
      const tpl = await templateRepo.get(plan.templateId);
      if (tpl) await sessionRepo.create(sessionFromTemplate(tpl, today()));
      return;
    }
    // Same as „Erledigt“ on the page: it counts today.
    await sessionRepo.update(id, doneToday(today()));
  },
  async onEstimate(id, minutes) {
    // A plan day has no record of its own; its length stays the template's.
    if (parsePlanItemId(id)) return;
    await sessionRepo.update(id, { durationMin: Math.max(1, Math.min(1440, Math.round(minutes))) });
  },
};

export default source;
