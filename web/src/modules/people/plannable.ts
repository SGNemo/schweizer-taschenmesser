/**
 * Gifts as a source of the planner (`contributions.plannable`, docs/design/planner-hub/CONCEPT-SOURCES.md §3.2
 * row 8): a gift that is not given yet (idea or bought) and has the day of its occasion inside the planned days
 * becomes „Geschenk für <Name>“, 20 minutes, hard due = that day. **The title never names the gift** – plan
 * titles travel into the calendar, the agenda and the widget, and a gift is a surprise (`schema.ts`; the gift is
 * never offered to the assistant either). Nothing else of the gift travels (no detail, no links). An occasion
 * that has passed leaves the plan (no row about a missed day). No tick: buying or giving is marked here, so the
 * row gets `action` „Zur Person“. Birthdays stay all-day calendar items (`calendar.ts`). Switch: `showInPlan`.
 */
import type { PlannableItem, PlannableSource } from '@/core/modules/types';
import { getSettings } from '@/core/settings/settings';
import { t } from '@/strings';
import { giftRepo, personRepo } from './repo';
import { settings } from './settings';

export const GIFT_MINUTES = 20;

/** The person's page, opened on the person (`?open=` takes a person or a gift id; the page shows `?person=`). */
export const personRoute = (personId: string): string =>
  `/people?open=${encodeURIComponent(personId)}`;

const source: PlannableSource = {
  async list(ctx) {
    const prefs = await getSettings('module.people', settings.schema, settings.defaults);
    if (!prefs.showInPlan) return [];
    const gifts = await giftRepo.table
      .where('date')
      .between(ctx.today, ctx.until, true, true)
      .filter((g) => g.deletedAt === null && g.status !== 'given')
      .toArray();
    const items: PlannableItem[] = [];
    for (const g of gifts) {
      const person = await personRepo.get(g.personId);
      if (!person || !g.date) continue; // a gift of a removed person has nobody to go to
      items.push({
        id: g.id,
        kind: 'gift',
        title: t.people.planTitle(person.name),
        to: personRoute(person.id),
        durationMin: GIFT_MINUTES,
        priority: 1,
        due: { date: g.date, hard: true },
        action: { label: t.people.planAction, to: personRoute(person.id) },
        createdAt: g.createdAt,
      });
    }
    return items;
  },
};

export default source;
