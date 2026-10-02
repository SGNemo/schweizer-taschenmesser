export interface TimelineItem {
  key: string;
  title: string;
  /** Local wall clock 'HH:mm'; absent for all-day items. */
  time?: string;
  endTime?: string;
  allDay: boolean;
  /** Small kind tag ("Termin", "Erinnerung"). */
  kind?: string;
  to?: string;
}

export type TimelineRow =
  | { type: 'item'; item: TimelineItem; next: boolean; past: boolean }
  | { type: 'now'; time: string };

/**
 * Orders a day: all-day items first, then timed items by start. The "now" marker is inserted before
 * the first item that has not started yet; that item is the highlighted "next" one. Items that
 * ended (or started when there is no end) before `now` are `past`.
 */
export function buildTimeline(items: readonly TimelineItem[], now: string | null): TimelineRow[] {
  const allDay = items.filter((i) => i.allDay || !i.time);
  const timed = items
    .filter((i) => !i.allDay && i.time)
    .sort((a, b) => a.time!.localeCompare(b.time!));
  const rows: TimelineRow[] = allDay.map((item) => ({
    type: 'item',
    item,
    next: false,
    past: false,
  }));
  let marked = now === null;
  let nextSet = false;
  for (const item of timed) {
    const started = now !== null && item.time! <= now;
    if (!marked && !started) {
      rows.push({ type: 'now', time: now! });
      marked = true;
    }
    const over = now !== null && (item.endTime ?? item.time!) < now;
    const isNext = !started && !nextSet && now !== null;
    if (isNext) nextSet = true;
    rows.push({ type: 'item', item, next: isNext, past: over });
  }
  if (!marked && now !== null) rows.push({ type: 'now', time: now });
  return rows;
}
