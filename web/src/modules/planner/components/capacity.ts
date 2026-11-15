import { formatMinutes } from '@/core/i18n/format';
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
