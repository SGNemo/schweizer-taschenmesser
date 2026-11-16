/**
 * The numbers of the „Übersicht“ view (round „Tiefe & Politur“, docs/design/subscriptions-deep/PLAN.md): shares for
 * the donut, the charges of the next 30 days, the yearly ranking and the list sort. Pure functions, no UI words:
 * the page names the groups. Only running subscriptions count (active, a charge still ahead), as in `totals`.
 */
import { compareText } from '@/core/i18n/format';
import { currencyOf, DEFAULT_CURRENCY } from '@/core/money';
import { addDaysStr } from '@/core/time/dates';
import { annualCost, chargesInRange, nextCharge, sortSubscriptions } from './logic';
import type { Subscription, SubscriptionCategory } from './schema';

type Sub = Pick<
  Subscription,
  'name' | 'amountMinor' | 'currency' | 'recurrence' | 'startDate' | 'active' | 'category'
> & { id: string };

/** Charged at least once more: active and the rule has not ended. */
export const isRunning = (s: Sub, today: string): boolean =>
  s.active && nextCharge(s, today) !== undefined;

/**
 * The currency the charts are drawn in: the euro when anything runs in it, else the first by code. Amounts of
 * other currencies are never added to it (the page says how many are left out).
 */
export function mainCurrency(subs: readonly Sub[], today: string): string | undefined {
  const codes = [...new Set(subs.filter((s) => isRunning(s, today)).map((s) => currencyOf(s)))];
  if (codes.includes(DEFAULT_CURRENCY)) return DEFAULT_CURRENCY;
  return codes.sort()[0];
}

/** How the donut groups: by the kind of service, or one slice per subscription („Anbieter“). */
export type ShareBy = 'category' | 'provider';

/** A group without a category. */
export const NO_CATEGORY = 'none';

export interface CostShare {
  /** Category key (`NO_CATEGORY` for none) or the subscription id. */
  id: string;
  /** Category key or the subscription's name; the page turns a key into words. */
  label: string;
  /** Cost per month in cents (yearly cost / 12, rounded once per group). */
  value: number;
}

/** Monthly cost per category or per subscription, running ones in `currency` only, largest first. */
export function costShares(
  subs: readonly Sub[],
  today: string,
  by: ShareBy,
  currency: string,
): CostShare[] {
  const running = subs.filter((s) => isRunning(s, today) && currencyOf(s) === currency);
  const groups = new Map<string, { label: string; yearly: number }>();
  for (const s of running) {
    const key = by === 'provider' ? s.id : (s.category ?? NO_CATEGORY);
    const label = by === 'provider' ? s.name : key;
    const g = groups.get(key) ?? { label, yearly: 0 };
    g.yearly += annualCost(s);
    groups.set(key, g);
  }
  return [...groups]
    .map(([id, g]) => ({ id, label: g.label, value: Math.round(g.yearly / 12) }))
    .filter((g) => g.value > 0)
    .sort((a, b) => b.value - a.value || compareText(a.label, b.label));
}

/** Running subscriptions left out of the charts because they are in another currency. */
export const otherCurrencyCount = (subs: readonly Sub[], today: string, currency: string): number =>
  subs.filter((s) => isRunning(s, today) && currencyOf(s) !== currency).length;

/** Days the timeline looks ahead (today included). */
export const UPCOMING_DAYS = 30;

export interface UpcomingCharge {
  id: string;
  name: string;
  /** 'YYYY-MM-DD' */
  date: string;
  amountMinor: number;
  currency: string;
}

/** Every charge of an active subscription from today through the next `days - 1` days, by date, then name. */
export function upcomingCharges(
  subs: readonly Sub[],
  today: string,
  days = UPCOMING_DAYS,
): UpcomingCharge[] {
  const to = addDaysStr(today, days - 1);
  return subs
    .filter((s) => s.active)
    .flatMap((s) =>
      chargesInRange(s, today, to).map((date) => ({
        id: s.id,
        name: s.name,
        date,
        amountMinor: s.amountMinor,
        currency: currencyOf(s),
      })),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || compareText(a.name, b.name));
}

/** The charges grouped by day, in order: one group per date. */
export function byDay<T extends { date: string }>(
  charges: readonly T[],
): { date: string; items: T[] }[] {
  const out: { date: string; items: T[] }[] = [];
  for (const c of charges) {
    const last = out[out.length - 1];
    if (last?.date === c.date) last.items.push(c);
    else out.push({ date: c.date, items: [c] });
  }
  return out;
}

/** Sum of charges per currency, the euro first; nothing is converted. */
export function sumByCurrency(
  charges: readonly { amountMinor: number; currency: string }[],
): Map<string, number> {
  const sums = new Map<string, number>();
  for (const c of charges) sums.set(c.currency, (sums.get(c.currency) ?? 0) + c.amountMinor);
  return new Map(
    [...sums].sort(([a], [b]) =>
      a === DEFAULT_CURRENCY ? -1 : b === DEFAULT_CURRENCY ? 1 : a.localeCompare(b),
    ),
  );
}

/** „Was kostet mich das im Jahr“: every running subscription in `currency`, by yearly cost (rounded), largest first. */
export function yearlyRanking<T extends Sub>(
  subs: readonly T[],
  today: string,
  currency: string,
): { sub: T; yearly: number }[] {
  return subs
    .filter((s) => isRunning(s, today) && currencyOf(s) === currency)
    .map((sub) => ({ sub, yearly: Math.round(annualCost(sub)) }))
    .sort((a, b) => b.yearly - a.yearly || compareText(a.sub.name, b.sub.name));
}

/** How the list is ordered. */
export const SORT_KEYS = ['next', 'cost', 'name'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const isSortKey = (v: string | null): v is SortKey =>
  !!v && (SORT_KEYS as readonly string[]).includes(v);

/**
 * The list in the chosen order; paused and ended ones always come last (they cost nothing now).
 * `cost`: by yearly cost, largest first, grouped by currency (the euro first) so amounts of different currencies
 * are never ranked against each other. `next`: by next charge (`sortSubscriptions`). `name`: alphabetical.
 */
export function sortList<T extends Sub>(list: readonly T[], today: string, key: SortKey): T[] {
  if (key === 'next') return sortSubscriptions([...list], today);
  const rank = (s: T) => (isRunning(s, today) ? 0 : 1);
  const cur = (s: T) => {
    const c = currencyOf(s);
    return c === DEFAULT_CURRENCY ? '' : c;
  };
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (key === 'cost' ? cur(a).localeCompare(cur(b)) || annualCost(b) - annualCost(a) : 0) ||
      compareText(a.name, b.name),
  );
}

/** The category keys in the order the editor lists them, plus `NO_CATEGORY`; for typed labels. */
export type ShareKey = SubscriptionCategory | typeof NO_CATEGORY;
