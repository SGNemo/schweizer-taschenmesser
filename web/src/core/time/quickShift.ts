/**
 * Quick shifts for dates and reminders: the presets behind the date chips ("Heute", "Morgen",
 * "Nächste Woche") and the snooze of a reminder that is not firing right now. Pure; the callers
 * pass the reference day or time (`today()` / `now()`), never `Date.now()`.
 */
import { snoozeUntil, type SnoozeOption } from '@/core/notifications/snooze';
import { addDaysStr, isoWeekday, toDateString } from './dates';
import { pad2 } from './now';

export const DATE_PRESETS = ['today', 'tomorrow', 'nextWeek'] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

/** The date a preset means, seen from `from` (`YYYY-MM-DD`). "Nächste Woche" = next Monday. */
export function presetDate(preset: DatePreset, from: string): string {
  switch (preset) {
    case 'today':
      return from;
    case 'tomorrow':
      return addDaysStr(from, 1);
    case 'nextWeek':
      return addDaysStr(from, 8 - isoWeekday(from));
  }
}

/** Moves a date by whole days. */
export const shiftDays = (date: string, days: number): string => addDaysStr(date, days);

/** Moves a date and time by minutes, crossing midnight when needed. */
export function shiftMinutes(
  date: string,
  time: string,
  minutes: number,
): { date: string; time: string } {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const total = h * 60 + m + minutes;
  const dayShift = Math.floor(total / 1440);
  const rest = ((total % 1440) + 1440) % 1440;
  return {
    date: addDaysStr(date, dayShift),
    time: `${pad2(Math.floor(rest / 60))}:${pad2(rest % 60)}`,
  };
}

/** Local date and time a snooze option ends at, seen from the epoch `at`. */
export function snoozeTarget(
  option: Exclude<SnoozeOption, 'pc'>,
  at: number,
): { date: string; time: string } {
  const until = new Date(snoozeUntil(option, at));
  return {
    date: toDateString(until),
    time: `${pad2(until.getHours())}:${pad2(until.getMinutes())}`,
  };
}
