import { compareText } from '@/core/i18n/format';
import { currencyOf, DEFAULT_CURRENCY } from '@/core/money';
import { firstOnOrAfter, occurrencesBetween } from '@/core/recurrence/expand';
import { minusNotice, plusNotice, type NoticeValue } from '@/core/deadline/notice';
import { addDaysStr, daysBetween } from '@/core/time/dates';
import type { PriceChange, Subscription } from './schema';

type Sub = Pick<
  Subscription,
  | 'amountMinor'
  | 'currency'
  | 'recurrence'
  | 'startDate'
  | 'cancelNoticeDays'
  | 'cancelNoticeMonths'
  | 'active'
>;

/** The notice period of a subscription, or undefined when it has none. */
export const noticeOf = (
  s: Pick<Sub, 'cancelNoticeDays' | 'cancelNoticeMonths'>,
): NoticeValue | undefined =>
  s.cancelNoticeDays === undefined
    ? undefined
    : { days: s.cancelNoticeDays, months: s.cancelNoticeMonths };

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

/**
 * Totals per currency (the euro first, then by code); a subscription without a currency is in euro.
 * Currencies without any counted subscription are left out.
 * Nothing is converted, so amounts of different currencies are never added.
 */
export function totalsByCurrency(subs: Sub[], today?: string): Map<string, CostTotals> {
  const groups = new Map<string, Sub[]>();
  for (const s of subs) {
    const c = currencyOf(s);
    groups.set(c, [...(groups.get(c) ?? []), s]);
  }
  return new Map(
    [...groups]
      .map(([c, list]) => [c, totals(list, today)] as const)
      // A currency with nothing active in it (only paused ones) adds no "0" to the totals.
      .filter(([, sum]) => sum.yearly > 0)
      .sort(([a], [b]) =>
        a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
      ),
  );
}

/** Monthly or yearly totals of `totalsByCurrency` as plain amounts per currency, for `formatTotals`. */
export const pickTotals = (
  byCurrency: Map<string, CostTotals>,
  key: keyof CostTotals,
): Map<string, number> => new Map([...byCurrency].map(([c, v]) => [c, v[key]]));

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
  s: Pick<Sub, 'recurrence' | 'startDate' | 'cancelNoticeDays' | 'cancelNoticeMonths'>,
  from: string,
): CancelDeadline | undefined {
  const n = noticeOf(s);
  if (!n) return undefined;
  let search = plusNotice(from, n);
  // With calendar months the deadline of the first candidate can fall a day or two before `from`
  // (31 Jan + 1 month clamps to 28 Feb); that charge is no longer reachable, take the next one.
  for (let i = 0; i < 3; i++) {
    const charge = firstOnOrAfter(s.recurrence, s.startDate, search);
    if (!charge) return undefined;
    const deadline = minusNotice(charge, n);
    if (deadline >= from) return { deadline, charge };
    search = addDaysStr(charge, 1);
  }
  return undefined;
}

/** Cycles at most this many times a year (quarterly or longer) keep a missed deadline visible until the charge. */
const MISSED_MAX_CHARGES_PER_YEAR = 4;
/** With shorter cycles (monthly …) a deadline counts as missed only this many days, so it never nags all month. */
export const MISSED_RECENT_DAYS = 7;

/**
 * A deadline that has just passed for a charge that is still ahead: the contract renews anyway and a
 * cancellation now only takes effect afterwards. For cycles of a quarter or longer the note stays
 * until the charge; for shorter ones (monthly with a long notice period) it shows for
 * `MISSED_RECENT_DAYS` after the deadline only, otherwise it would be "missed" all the time.
 * Active subscriptions that are not already cancelled "zum" a date.
 */
export function missedDeadline(
  s: Pick<Sub, 'recurrence' | 'startDate' | 'cancelNoticeDays' | 'cancelNoticeMonths' | 'active'>,
  today: string,
): CancelDeadline | undefined {
  const n = noticeOf(s);
  if (!s.active || !n || s.recurrence.until) return undefined;
  if (chargesPerYear(s.recurrence) <= MISSED_MAX_CHARGES_PER_YEAR) {
    const charge = nextCharge(s, today);
    if (!charge) return undefined;
    const deadline = minusNotice(charge, n);
    return deadline < today ? { deadline, charge } : undefined;
  }
  // Short cycles: the most recent deadline that passed within the last `MISSED_RECENT_DAYS`, for a
  // charge that is still ahead. Candidates come from a slightly wider range (calendar months are not
  // a fixed number of days); the exact deadline decides.
  const first = addDaysStr(today, -MISSED_RECENT_DAYS);
  const last = addDaysStr(today, -1);
  const charges = chargesInRange(
    s,
    addDaysStr(plusNotice(first, n), -3),
    addDaysStr(plusNotice(last, n), 3),
  ).filter((c) => c >= today && minusNotice(c, n) >= first && minusNotice(c, n) <= last);
  const charge = charges[charges.length - 1];
  return charge ? { deadline: minusNotice(charge, n), charge } : undefined;
}

/** Cancellation deadlines that fall within [from, to]. */
export function cancelDeadlinesInRange(
  s: Pick<Sub, 'recurrence' | 'startDate' | 'cancelNoticeDays' | 'cancelNoticeMonths'>,
  from: string,
  to: string,
): CancelDeadline[] {
  const n = noticeOf(s);
  if (!n) return [];
  return occurrencesBetween(
    s.recurrence,
    s.startDate,
    addDaysStr(plusNotice(from, n), -3),
    addDaysStr(plusNotice(to, n), 3),
  )
    .map((charge) => ({ charge, deadline: minusNotice(charge, n) }))
    .filter((d) => d.deadline >= from && d.deadline <= to);
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

/** What one charge cost per month, in cents, rounded half up (a weekly 5,00 € is 21,67 €). */
export const monthlyEquivalent = (s: Pick<Sub, 'amountMinor' | 'recurrence'>): number =>
  Math.round(annualCost(s) / 12);

export type SubscriptionStatus = 'trial' | 'paused' | 'cancelled' | 'ended' | 'active';

/**
 * The state shown as a chip. `paused` is the switch ("Aktiv" off); `cancelled` has a last day that
 * is still ahead ("zum" date), `ended` has none left; `trial` is within the free period.
 */
export function subscriptionStatus(
  s: Pick<Sub, 'recurrence' | 'startDate' | 'active'> & { trialEndsOn?: string },
  today: string,
): SubscriptionStatus {
  if (!s.active) return 'paused';
  if (s.recurrence.until) return s.recurrence.until >= today ? 'cancelled' : 'ended';
  if (nextCharge(s, today) === undefined) return 'ended';
  return s.trialEndsOn && s.trialEndsOn >= today ? 'trial' : 'active';
}

/** Days until the trial ends (0 = today); undefined without a trial or after it. */
export function trialDaysLeft(s: { trialEndsOn?: string }, today: string): number | undefined {
  return s.trialEndsOn && s.trialEndsOn >= today ? daysBetween(today, s.trialEndsOn) : undefined;
}

/**
 * The most expensive running subscriptions by yearly cost, in the main currency (the euro, else the
 * first by code): amounts of other currencies are never ranked against it.
 */
export function topExpensive<T extends Sub & { name: string }>(
  subs: readonly T[],
  today: string,
  n = 3,
): T[] {
  const running = subs.filter((s) => s.active && nextCharge(s, today) !== undefined);
  const currencies = [...new Set(running.map((s) => currencyOf(s)))].sort((a, b) =>
    a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
  );
  const main = currencies[0];
  return running
    .filter((s) => currencyOf(s) === main)
    .sort((a, b) => annualCost(b) - annualCost(a) || compareText(a.name, b.name))
    .slice(0, n);
}

/** One or two capital letters for a service tile: "Streaming Plus" → "SP", "Spotify" → "S". */
export function monogram(name: string): string {
  const words = name
    .trim()
    .split(/[\s\-_.]+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w));
  const letters = words.map((w) => [...w].find((c) => /\p{L}|\p{N}/u.test(c)) ?? '');
  const out = letters.length > 1 ? letters[0]! + letters[1]! : (letters[0] ?? '');
  return (out || '?').toLocaleUpperCase();
}

/** The same name always gets the same entry of `palette` (a small string hash, no randomness). */
export function paletteIndex(name: string, size: number): number {
  let h = 0;
  for (const c of name.trim().toLocaleLowerCase()) h = (h * 31 + c.codePointAt(0)!) >>> 0;
  return size > 0 ? h % size : 0;
}
