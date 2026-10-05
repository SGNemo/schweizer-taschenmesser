import { addDaysStr, daysBetween, startOfWeekStr } from './dates';

/** Time buckets for lists, in display order. */
export type TimeGroupId = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none';
export const TIME_GROUP_ORDER: readonly TimeGroupId[] = [
  'overdue',
  'today',
  'tomorrow',
  'week',
  'later',
  'none',
];

/**
 * The bucket of a date relative to `today`. Finished items never count as overdue (they go by their
 * date like everything else), mirroring `dueState`. "Diese Woche" = the rest of the current week
 * after tomorrow; everything further out is "Später"; no date at all is "Ohne Datum".
 */
export function timeGroupOf(
  date: string | undefined,
  today: string,
  opts: { done?: boolean; weekStart?: 1 | 7 } = {},
): TimeGroupId {
  if (!date) return 'none';
  const d = daysBetween(today, date);
  if (d < 0) return opts.done ? 'later' : 'overdue';
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  const nextWeek = addDaysStr(startOfWeekStr(today, opts.weekStart ?? 1), 7);
  return daysBetween(date, nextWeek) > 0 ? 'week' : 'later';
}

export interface Group<T> {
  id: string;
  items: T[];
}

/** Buckets `items` by time; empty buckets are omitted, the order inside a bucket is kept. */
export function groupByTime<T>(
  items: readonly T[],
  dateOf: (item: T) => string | undefined,
  today: string,
  opts: { doneOf?: (item: T) => boolean; weekStart?: 1 | 7 } = {},
): Group<T>[] {
  const buckets = new Map<TimeGroupId, T[]>();
  for (const item of items) {
    const id = timeGroupOf(dateOf(item), today, {
      done: opts.doneOf?.(item),
      weekStart: opts.weekStart,
    });
    const list = buckets.get(id);
    if (list) list.push(item);
    else buckets.set(id, [item]);
  }
  return TIME_GROUP_ORDER.flatMap((id) => {
    const list = buckets.get(id);
    return list ? [{ id, items: list }] : [];
  });
}

/** Buckets by a status id in the given display order; unknown statuses are appended at the end. */
export function groupByStatus<T>(
  items: readonly T[],
  statusOf: (item: T) => string,
  order: readonly string[],
): Group<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const id = statusOf(item);
    const list = buckets.get(id);
    if (list) list.push(item);
    else buckets.set(id, [item]);
  }
  const known = order.flatMap((id) => (buckets.has(id) ? [{ id, items: buckets.get(id)! }] : []));
  const rest = [...buckets].filter(([id]) => !order.includes(id)).map(([id, v]) => ({ id, items: v }));
  return [...known, ...rest];
}
