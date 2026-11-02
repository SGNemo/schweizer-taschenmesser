import type { CalendarItem } from '@/core/modules/types';

/** The next appointment of the day: the first timed item that has not started yet (all-day items do not count as "next"). */
export function nextAppointment(
  items: readonly CalendarItem[],
  nowTime: string,
): CalendarItem | undefined {
  return items
    .filter((i) => !i.allDay && !i.done && !!i.time && i.time >= nowTime)
    .sort((a, b) => a.time!.localeCompare(b.time!))[0];
}

/** Whole minutes from `nowTime` (HH:mm) to `time` (HH:mm), never negative. */
export function minutesUntil(time: string, nowTime: string): number {
  const [h, m] = time.split(':').map(Number);
  const [nh, nm] = nowTime.split(':').map(Number);
  return Math.max(0, h! * 60 + m! - (nh! * 60 + nm!));
}
