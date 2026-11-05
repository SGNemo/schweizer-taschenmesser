import { formatMinutes } from '@/core/i18n/format';
import { t } from '@/strings';

export const compact = (min: number): string => formatMinutes(min, { compact: true });

type Capacity = { off: boolean; free: number; planned: number; usable: number };

/** The one capacity word of a day: „frei“ (off), „keine freie Zeit“, „voll“, or „x frei von y“. */
export function capacityLabel(day: Capacity): string {
  if (day.off) return t.planner.board.off;
  if (day.usable === 0 && day.planned === 0) return t.planner.board.noTime;
  if (day.free === 0 && day.planned > 0) return t.planner.board.full;
  return t.planner.board.freeOf(compact(day.free), compact(day.usable));
}

/** The strip chip: the free time alone, or the state word. */
export function capacityShort(day: Capacity): string {
  if (day.off) return t.planner.board.off;
  if (day.usable === 0 && day.planned === 0) return t.planner.board.noTime;
  if (day.free === 0 && day.planned > 0) return t.planner.board.full;
  return compact(day.free);
}
