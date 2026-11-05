import { formatMinutes } from '@/core/i18n/format';
import { t } from '@/strings';

export const compact = (min: number): string => formatMinutes(min, { compact: true });

type Capacity = { off: boolean; free: number; planned: number; usable: number };

export type CapacityState = 'off' | 'noTime' | 'full' | 'free';

/** One reading of a day for every surface: off wins, then no usable time, then full, else free time. */
export function capacityState(day: Capacity): CapacityState {
  if (day.off) return 'off';
  if (day.usable === 0 && day.planned === 0) return 'noTime';
  if (day.free === 0 && day.planned > 0) return 'full';
  return 'free';
}

/** The capacity phrase of a day (column, sheet): „frei“, „keine freie Zeit“, „voll“ or „x frei von y“. */
export function capacityLabel(day: Capacity): string {
  switch (capacityState(day)) {
    case 'off':
      return t.planner.board.off;
    case 'noTime':
      return t.planner.board.noTime;
    case 'full':
      return t.planner.board.full;
    case 'free':
      return t.planner.board.freeOf(compact(day.free), compact(day.usable));
  }
}

/** The strip chip: the free time alone, or one state word. */
export function capacityShort(day: Capacity): string {
  switch (capacityState(day)) {
    case 'off':
      return t.planner.board.off;
    case 'noTime':
      return t.planner.board.noTimeShort;
    case 'full':
      return t.planner.board.full;
    case 'free':
      return compact(day.free);
  }
}
