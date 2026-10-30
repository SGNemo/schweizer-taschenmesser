import type { CalendarItem } from '@/core/modules/types';
import { addDaysStr } from '@/core/time/dates';

export interface AgendaDay {
  date: string;
  items: CalendarItem[];
}

export interface Agenda {
  today: CalendarItem[];
  tomorrow: CalendarItem[];
  /** The following days of the week (day + 2 … day + 6), only those with entries. */
  week: AgendaDay[];
  /** Entries left out by the limits, for the "+ n weitere" line. */
  hidden: number;
  empty: boolean;
}

export interface Limits {
  today: number;
  tomorrow: number;
  week: number;
}

/** Entries shown per group; the rest is one line pointing to the calendar. */
export const LIMITS: Record<'calm' | 'all', Limits> = {
  calm: { today: 3, tomorrow: 1, week: 1 },
  all: { today: 5, tomorrow: 3, week: 4 },
};

/** The span the block covers: today, tomorrow and the days up to a week ahead. */
export const agendaRange = (day: string) => ({ from: day, to: addDaysStr(day, 6) });

/**
 * Groups calendar items into "Heute · Morgen · diese Woche". Done items are left out, and so are
 * the ToDos due today: the "Heute" card already lists them as the day plan.
 */
export function buildAgenda(
  items: readonly CalendarItem[],
  day: string,
  limits: Limits = LIMITS.all,
): Agenda {
  const open = items.filter((i) => !i.done);
  const tomorrowDate = addDaysStr(day, 1);
  const today = open.filter((i) => i.date === day && i.source !== 'todos');
  const tomorrow = open.filter((i) => i.date === tomorrowDate);
  const weekItems = open.filter((i) => i.date > tomorrowDate && i.date <= addDaysStr(day, 6));

  const week: AgendaDay[] = [];
  let weekShown = 0;
  let hidden = 0;
  for (const i of weekItems) {
    if (weekShown >= limits.week) {
      hidden += 1;
      continue;
    }
    const last = week[week.length - 1];
    if (last?.date === i.date) last.items.push(i);
    else week.push({ date: i.date, items: [i] });
    weekShown += 1;
  }
  hidden +=
    Math.max(0, today.length - limits.today) + Math.max(0, tomorrow.length - limits.tomorrow);
  return {
    today: today.slice(0, limits.today),
    tomorrow: tomorrow.slice(0, limits.tomorrow),
    week,
    hidden,
    empty: today.length + tomorrow.length + weekItems.length === 0,
  };
}
