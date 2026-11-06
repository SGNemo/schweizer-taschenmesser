import type { CalendarItem } from '@/core/modules/types';
import type { PlanBlocker, PlanDay, PlanSettings } from './types';

/** Minutes an appointment with a start but no end blocks (the calendar's `DEFAULT_BLOCK_MINUTES`). */
export const DEFAULT_APPOINTMENT_MIN = 60;
/** Minutes an all-day appointment blocks when `allDayBlocks` is on. */
export const ALL_DAY_BLOCK_MIN = 240;

const toMinutes = (hhmm: string): number =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const toTime = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Rule 1: which calendar items block time. Only items of kind `event` or `external` with a start
 * time count (minutes = end − start, else 60); reminders, ToDos, plan chips and done items never
 * block; all-day items block nothing unless `allDayBlocks`. Pure; the result is a blocker per item,
 * a timed one with its `from`/`to` (the minutes stay end − start, also when `to` is cut at midnight).
 */
export function calendarBlockers(
  items: readonly CalendarItem[],
  opts: { allDayBlocks?: boolean } = {},
): (PlanBlocker & { date: string })[] {
  const out: (PlanBlocker & { date: string })[] = [];
  for (const i of items) {
    if (i.done) continue;
    if (i.kind !== 'event' && i.kind !== 'external') continue;
    if (i.allDay || !i.time) {
      if (opts.allDayBlocks && i.allDay)
        out.push({
          id: `cal:${i.source}:${i.id}`,
          label: i.title,
          min: ALL_DAY_BLOCK_MIN,
          date: i.date,
        });
      continue;
    }
    const start = toMinutes(i.time);
    const end = i.endTime ? toMinutes(i.endTime) : start + DEFAULT_APPOINTMENT_MIN;
    const min = end > start ? end - start : DEFAULT_APPOINTMENT_MIN;
    // The stretch it takes (package 5: kept free in a day's window); never past the end of the day.
    const to = Math.min(start + min, 23 * 60 + 59);
    out.push({
      id: `cal:${i.source}:${i.id}`,
      label: i.title,
      min,
      date: i.date,
      from: i.time,
      ...(to > start ? { to: toTime(to) } : {}),
    });
  }
  return out;
}

export interface Capacity {
  raw: number;
  usable: number;
  blocked: number;
}

/** `raw = available − Σ blockers`, `usable = raw × (1 − buffer)`. */
export function capacity(day: PlanDay, settings: Pick<PlanSettings, 'bufferShare'>): Capacity {
  const blocked = day.blockers.reduce((n, b) => n + b.min, 0);
  const raw = Math.max(0, day.availableMin - blocked);
  return { raw, usable: Math.floor(raw * (1 - settings.bufferShare)), blocked };
}
