/**
 * The head of the planner page (planner hub R1, CONCEPT-DESIGN §5): it reports the next day that asks for
 * something – today while today holds things, else the first later day that does. One figure, one context line.
 * Pure; the texts are read at call time.
 */
import { relativeDays } from '@/core/i18n/format';
import { formatDay } from '@/core/time/dates';
import { t } from '@/strings';
import type { BoardDay } from './board';
import { compact } from './components/capacity';

export interface PlannerHead {
  value: string;
  detail: string;
}

type HeadDay = Pick<BoardDay, 'date' | 'isToday' | 'free' | 'over' | 'rows'>;

/** The first day of the board that holds planned things (the day the page opens on). */
export function firstDayWithRows<T extends Pick<BoardDay, 'rows'>>(
  days: readonly T[],
): T | undefined {
  return days.find((d) => d.rows.length > 0);
}

/** Open things of a day (a thing cut into parts counts once). */
const thingsOf = (day: HeadDay): number => new Set(day.rows.map((r) => r.itemKey)).size;

/**
 * Rule 1: today has rows → today's free time, context „heute · 3 Dinge“ (exactly one thing: „Heute: … Das reicht
 * für heute.“). Rule 2: else the first day with rows → its figure, context „morgen, Mo. 16. · heute ist frei“
 * (`short`: the first half, for the phone). Rule 4: no rows at all → no figure. (Rule 3, only late money, is R2.)
 */
export function plannerHead(
  days: readonly HeadDay[],
  opts: { short?: boolean } = {},
): PlannerHead | undefined {
  const day = firstDayWithRows(days);
  if (!day) return undefined;
  const h = t.planner.head;
  const tomorrow = days[1]?.date === day.date;
  const value =
    day.free > 0
      ? h.free(compact(day.free))
      : day.over > 0
        ? h.over(compact(day.over))
        : day.isToday
          ? h.full
          : h.fullNext(tomorrow ? relativeDays(1) : formatDay(day.date, 'EEEE'));
  if (day.isToday) {
    const things = thingsOf(day);
    return { value, detail: things === 1 ? h.first(day.rows[0]!.title) : h.ctxToday(things) };
  }
  const name = formatDay(day.date, 'EEE d.');
  return {
    value,
    detail: opts.short ? h.ctxNextShort(name, tomorrow) : h.ctxNext(name, tomorrow),
  };
}
