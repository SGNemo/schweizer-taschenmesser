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
/** The calendar thing behind a blocker: the entity a link points to and the item (occurrence) its panel opens. */
export interface BlockerRef {
  module: string;
  /** The entity (`CalendarItem.entityId`). */
  id: string;
  /** The item itself (`CalendarItem.id`, an occurrence key). */
  item: string;
  /** The item's route in its module (`CalendarItem.to`): „Ganz öffnen“. */
  to?: string;
}

export function calendarBlockers(
  items: readonly CalendarItem[],
  opts: { allDayBlocks?: boolean } = {},
): (PlanBlocker & { date: string; ref?: BlockerRef })[] {
  const out: (PlanBlocker & { date: string; ref?: BlockerRef })[] = [];
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
      // A timed appointment that is a link target (package 9): its row opens, „Vorbereiten …“ links to it.
      ...(i.entityId && i.kind === 'event'
        ? { ref: { module: i.source, id: i.entityId, item: i.id, ...(i.to ? { to: i.to } : {}) } }
        : {}),
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

const HHMM = /^\d{2}:\d{2}$/;
const DAY_END_MIN = 23 * 60 + 59;

/**
 * The stretch of a fixed item (planner hub S4): its own `to`, else `from` + its minutes, never past the end of the
 * day. `undefined` when `from` is no 'HH:mm'.
 */
export function fixedSpan(
  fixed: { from: string; to?: string },
  minutes: number,
): { from: string; to: string } | undefined {
  if (!HHMM.test(fixed.from)) return undefined;
  const start = toMinutes(fixed.from);
  const own = fixed.to && HHMM.test(fixed.to) ? toMinutes(fixed.to) : undefined;
  const end = Math.min(own !== undefined && own > start ? own : start + minutes, DAY_END_MIN);
  return end > start ? { from: fixed.from, to: toTime(end) } : undefined;
}

/**
 * What each fixed item of a day takes from its time (planner hub S4): its stretch minus what a timed blocker of the
 * day or an earlier fixed item of the list already covers – a training that overlaps an appointment is never
 * counted twice. An item without a stretch takes its whole minutes. Same list in, same numbers out.
 */
export function fixedCharges(
  fixed: readonly { minutes: number; from?: string; to?: string }[],
  blockers: readonly Pick<PlanBlocker, 'from' | 'to'>[],
): number[] {
  const busy = new Uint8Array(24 * 60);
  const span = (from?: string, to?: string): [number, number] | undefined =>
    from && to && HHMM.test(from) && HHMM.test(to) && from < to
      ? [toMinutes(from), toMinutes(to)]
      : undefined;
  for (const b of blockers) {
    const s = span(b.from, b.to);
    if (s) busy.fill(1, s[0], s[1]);
  }
  return fixed.map((f) => {
    const s = span(f.from, f.to);
    if (!s) return f.minutes;
    let free = 0;
    for (let m = s[0]; m < s[1]; m++) if (!busy[m]) free++;
    busy.fill(1, s[0], s[1]);
    return free;
  });
}
