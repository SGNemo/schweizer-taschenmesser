/**
 * The "Heute" card of the home screen: what is on today in one place, built from the ToDos and the
 * calendar items other modules contribute. Pure selection on top of `next.ts`; nothing here writes.
 * Order on the card: time to the next appointment, "Jetzt dran", the plan, today's appointments.
 */
import type { CalendarItem } from '@/core/modules/types';
import { minutesUntil, nextToday } from '@/core/time/until';
import { dayPlan, pickNext, type DayPlan, type PickTask } from './next';

/** Appointments listed on the card before "all appointments". */
export const APPOINTMENT_LIMIT = 4;

/** The one appointment that sets the clock: the next timed, open item today. */
export interface UntilNext {
  item: CalendarItem;
  minutes: number;
}

export function untilNext(
  items: readonly CalendarItem[],
  day: string,
  nowHhmm: string,
): UntilNext | undefined {
  const item = nextToday(
    items.filter((i) => i.date === day && i.source !== 'todos'),
    nowHhmm,
  );
  return item ? { item, minutes: minutesUntil(nowHhmm, item.time!) } : undefined;
}

/** Sort key: all-day and untimed items before every start time. */
const startKey = (i: CalendarItem): string => (i.allDay || !i.time ? '' : i.time);

/**
 * Today's open appointments that still matter: all-day and untimed ones first, then by start time,
 * and only those that have not ended. ToDos are left out (they are the plan, not appointments).
 */
export function todayAppointments(
  items: readonly CalendarItem[],
  day: string,
  nowHhmm: string,
  limit = APPOINTMENT_LIMIT,
): { shown: CalendarItem[]; hidden: number } {
  const open = items
    .filter(
      (i) =>
        i.date === day &&
        i.source !== 'todos' &&
        !i.done &&
        (i.allDay || !i.time || (i.endTime ?? i.time) >= nowHhmm),
    )
    .sort((a, b) => startKey(a).localeCompare(startKey(b)));
  return { shown: open.slice(0, limit), hidden: Math.max(0, open.length - limit) };
}

export interface TodayInput<T extends PickTask> {
  tasks: readonly T[];
  items: readonly CalendarItem[];
  day: string;
  nowHhmm: string;
  skipped: readonly string[];
  planLimit: number;
  /** "Jetzt dran" is on in the settings. */
  showNext: boolean;
}

export interface Today<T extends PickTask> {
  next: T | undefined;
  plan: DayPlan<T>;
  /** Plan rows without the suggested task (it is already shown above them). */
  planRows: T[];
  until: UntilNext | undefined;
  appointments: { shown: CalendarItem[]; hidden: number };
}

export function buildToday<T extends PickTask>(input: TodayInput<T>): Today<T> {
  const next = input.showNext ? pickNext(input.tasks, input.day, input.skipped) : undefined;
  const plan = dayPlan(input.tasks, input.day, input.planLimit);
  return {
    next,
    plan,
    planRows: plan.planned.filter((p) => p.id !== next?.id),
    until: untilNext(input.items, input.day, input.nowHhmm),
    appointments: todayAppointments(input.items, input.day, input.nowHhmm),
  };
}
