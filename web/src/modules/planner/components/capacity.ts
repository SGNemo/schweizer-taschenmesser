import { formatMinutes } from '@/core/i18n/format';
import { windowText, type TimeWindow } from '@/core/plan/windows';
import { t } from '@/strings';

export const compact = (min: number): string => formatMinutes(min, { compact: true });

type Capacity = { off: boolean; free: number; planned: number; usable: number; over?: number };

export type CapacityState = 'off' | 'noTime' | 'over' | 'full' | 'free';

/**
 * One reading of a day for every surface: off wins, then no usable time, then more planned than fits, then full,
 * else free time. `over` is a fact in words („40 Min mehr als planbar“), never a tone.
 */
export function capacityState(day: Capacity): CapacityState {
  if (day.off) return 'off';
  if (day.usable === 0 && day.planned === 0) return 'noTime';
  if ((day.over ?? 0) > 0) return 'over';
  if (day.free === 0 && day.planned > 0) return 'full';
  return 'free';
}

/** The capacity phrase of a day (sheet, dialog): „frei“, „keine freie Zeit“, „x mehr als planbar“, „voll“ or „x frei von y“. */
export function capacityLabel(day: Capacity): string {
  switch (capacityState(day)) {
    case 'off':
      return t.planner.board.off;
    case 'noTime':
      return t.planner.board.noTime;
    case 'over':
      return t.planner.head.over(compact(day.over ?? 0));
    case 'full':
      return t.planner.board.full;
    case 'free':
      return t.planner.board.freeOf(compact(day.free), compact(day.usable));
  }
}

/** The compact tile and the widget's short form: the free time alone, or one state word. */
export function capacityShort(day: Capacity): string {
  switch (capacityState(day)) {
    case 'off':
      return t.planner.board.off;
    case 'noTime':
      return t.planner.board.noTimeShort;
    case 'over':
      return t.planner.board.overShort(compact(day.over ?? 0));
    case 'full':
      return t.planner.board.full;
    case 'free':
      return compact(day.free);
  }
}

/** The wide tile's second line: „37 Min frei“, „40 Min mehr“ or one state word. */
export function capacityTile(day: Capacity): string {
  return capacityState(day) === 'free'
    ? t.planner.board.freeShort(compact(day.free))
    : capacityShort(day);
}

/**
 * „Warum?“ beside the day's capacity (planner hub R2, P80): one line that names what the time goes to – the day's
 * available time, every blocker by name with its length, the buffer, the time window and the day's end when set.
 * „4 h für den Tag. Abgezogen: Teamrunde 1 h, Puffer 36 Min. Tagesende 21:00.“ Text only.
 */
export function capacityWhy(
  day: {
    availableMin: number;
    raw: number;
    usable: number;
    blockers: readonly { label: string; min: number }[];
    window?: TimeWindow;
  },
  dayEnd?: string,
): string {
  const b = t.planner.board;
  const buffer = day.raw - day.usable;
  const off = [
    ...day.blockers.map((x) => `${x.label} ${compact(x.min)}`),
    ...(buffer > 0 ? [b.whyBuffer(compact(buffer))] : []),
  ];
  return [
    b.whyTime(compact(day.availableMin)),
    ...(off.length > 0 ? [b.whyOff(off.join(', '))] : []),
    ...(day.window ? [b.whyWindow(windowText(day.window))] : []),
    ...(dayEnd ? [b.whyEnd(dayEnd)] : []),
  ].join(' ');
}
