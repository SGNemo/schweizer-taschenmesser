import { addDaysStr, daysBetween } from '@/core/time/dates';
import type { Contract } from './schema';

type C = Pick<Contract, 'kind' | 'endDate' | 'noticeDays'>;

/** Last day to cancel; only for contracts with an end date and a notice period. */
export function cancelDeadline(c: C): string | undefined {
  return c.endDate && c.noticeDays !== undefined ? addDaysStr(c.endDate, -c.noticeDays) : undefined;
}

export type Status = 'expired' | 'act-now' | 'soon' | 'ok' | 'open-ended';

/** Days before a deadline/end from which an entry counts as "soon". */
export const SOON_DAYS = 30;

/**
 * - expired: the end date has passed
 * - act-now: the cancellation deadline is today or within 7 days (and not yet passed)
 * - soon: the deadline (or, without one, the end) is within `SOON_DAYS`
 */
export function statusOf(c: C, today: string): Status {
  if (!c.endDate) return 'open-ended';
  if (c.endDate < today) return 'expired';
  const deadline = cancelDeadline(c);
  const relevant = deadline && deadline >= today ? deadline : c.endDate;
  const days = daysBetween(today, relevant);
  if (deadline && deadline >= today && days <= 7) return 'act-now';
  return days <= SOON_DAYS ? 'soon' : 'ok';
}

/** The date that matters next: the deadline while it lies ahead, otherwise the end. */
export function nextRelevantDate(c: C, today: string): string | undefined {
  const deadline = cancelDeadline(c);
  if (deadline && deadline >= today) return deadline;
  return c.endDate;
}

const RANK: Record<Status, number> = { 'act-now': 0, soon: 1, ok: 2, 'open-ended': 3, expired: 4 };

/** Urgent first, then by the relevant date; expired and open-ended entries last. */
export function sortContracts<T extends C & { name: string }>(
  list: readonly T[],
  today: string,
): T[] {
  return [...list].sort((a, b) => {
    const sa = statusOf(a, today);
    const sb = statusOf(b, today);
    if (RANK[sa] !== RANK[sb]) return RANK[sa] - RANK[sb];
    const da = nextRelevantDate(a, today) ?? '9999-12-31';
    const db = nextRelevantDate(b, today) ?? '9999-12-31';
    return da.localeCompare(db) || a.name.localeCompare(b.name, 'de');
  });
}
