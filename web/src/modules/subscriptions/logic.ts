import { compareText } from '@/core/i18n/format';
import { firstOnOrAfter, occurrencesBetween } from '@/core/recurrence/expand';
import { addDaysStr } from '@/core/time/dates';
import type { PriceChange, Subscription } from './schema';

type Sub = Pick<
  Subscription,
  'amountMinor' | 'recurrence' | 'startDate' | 'cancelNoticeDays' | 'active'
>;

/** Charges per year implied by the rule (365 days, 52 weeks, 12 months). */
export function chargesPerYear(rule: Subscription['recurrence']): number {
  const n = rule.interval ?? 1;
  switch (rule.freq) {
    case 'daily':
      return 365 / n;
    case 'weekly':
      return ((rule.byWeekday?.length || 1) * 52) / n;
    case 'monthly':
      return 12 / n;
    case 'yearly':
      return 1 / n;
  }
}

/** Yearly cost in cents (unrounded so that totals do not accumulate rounding errors). */
export const annualCost = (s: Pick<Sub, 'amountMinor' | 'recurrence'>): number =>
  s.amountMinor * chargesPerYear(s.recurrence);

export interface CostTotals {
  monthly: number;
  yearly: number;
}

/**
 * Totals of all active subscriptions, rounded once at the end. With `today`, subscriptions whose
 * last charge is behind them (cancelled "zum" a date, or an ended rule) no longer count.
 */
export function totals(subs: Sub[], today?: string): CostTotals {
  const yearly = subs
    .filter((s) => s.active && (today === undefined || nextCharge(s, today) !== undefined))
    .reduce((sum, s) => sum + annualCost(s), 0);
  return { monthly: Math.round(yearly / 12), yearly: Math.round(yearly) };
}

/** Next charge on or after `from`, or undefined when the rule has ended. */
export const nextCharge = (
  s: Pick<Sub, 'recurrence' | 'startDate'>,
  from: string,
): string | undefined => firstOnOrAfter(s.recurrence, s.startDate, from);

export const chargesInRange = (
  s: Pick<Sub, 'recurrence' | 'startDate'>,
  from: string,
  to: string,
): string[] => occurrencesBetween(s.recurrence, s.startDate, from, to);

export interface CancelDeadline {
  /** Last day to cancel. */
  deadline: string;
  /** The charge that is avoided by cancelling in time. */
  charge: string;
}

/** The next cancellation deadline that is still reachable on `from`. */
export function nextCancelDeadline(
  s: Pick<Sub, 'recurrence' | 'startDate' | 'cancelNoticeDays'>,
  from: string,
): CancelDeadline | undefined {
  if (s.cancelNoticeDays === undefined) return undefined;
  const charge = firstOnOrAfter(s.recurrence, s.startDate, addDaysStr(from, s.cancelNoticeDays));
  return charge ? { deadline: addDaysStr(charge, -s.cancelNoticeDays), charge } : undefined;
}

/** Cycles at most this many times a year (quarterly or longer) are where a missed deadline matters. */
const MISSED_MAX_CHARGES_PER_YEAR = 4;

/**
 * A deadline that has just passed for a charge that is still ahead: the contract renews anyway and a
 * cancellation now only takes effect afterwards. Only for cycles of a quarter or longer (with a
 * monthly charge the deadline would always be "missed"), active and not already cancelled "zum".
 */
export function missedDeadline(
  s: Pick<Sub, 'recurrence' | 'startDate' | 'cancelNoticeDays' | 'active'>,
  today: string,
): CancelDeadline | undefined {
  if (!s.active || s.cancelNoticeDays === undefined || s.recurrence.until) return undefined;
  if (chargesPerYear(s.recurrence) > MISSED_MAX_CHARGES_PER_YEAR) return undefined;
  const charge = nextCharge(s, today);
  if (!charge) return undefined;
  const deadline = addDaysStr(charge, -s.cancelNoticeDays);
  return deadline < today ? { deadline, charge } : undefined;
}

/** Cancellation deadlines that fall within [from, to]. */
export function cancelDeadlinesInRange(
  s: Pick<Sub, 'recurrence' | 'startDate' | 'cancelNoticeDays'>,
  from: string,
  to: string,
): CancelDeadline[] {
  if (s.cancelNoticeDays === undefined) return [];
  const n = s.cancelNoticeDays;
  return occurrencesBetween(s.recurrence, s.startDate, addDaysStr(from, n), addDaysStr(to, n)).map(
    (charge) => ({
      charge,
      deadline: addDaysStr(charge, -n),
    }),
  );
}

/** Active first (by next charge), inactive last. */
export function sortSubscriptions<T extends Sub & { name: string }>(list: T[], today: string): T[] {
  const next = (s: T) => (s.active ? (nextCharge(s, today) ?? '9999-12-31') : '9999-99-99');
  return [...list].sort((a, b) => next(a).localeCompare(next(b)) || compareText(a.name, b.name));
}

/** Appends a price change to the history (nothing when the price is the same); keeps the last 20. */
export function recordPriceChange(
  history: readonly PriceChange[],
  date: string,
  fromMinor: number,
  toMinor: number,
): PriceChange[] {
  if (fromMinor === toMinor) return [...history];
  return [...history, { date, fromMinor, toMinor }].slice(-20);
}

/** Percent change of one entry, rounded ("+30"), positive for an increase. */
export const changePercent = (c: Pick<PriceChange, 'fromMinor' | 'toMinor'>): number =>
  Math.round(((c.toMinor - c.fromMinor) / c.fromMinor) * 100);

/** The newest price increase within the last `days` days, for the "Preis erhöht" hint. */
export function recentIncrease(
  history: readonly PriceChange[],
  today: string,
  days = 180,
): PriceChange | undefined {
  const since = addDaysStr(today, -days);
  return [...history].reverse().find((c) => c.date >= since && c.toMinor > c.fromMinor);
}
