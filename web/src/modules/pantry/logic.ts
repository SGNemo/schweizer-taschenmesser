import { capitalize, compareText } from '@/core/i18n/format';
import { daysBetween, formatDay } from '@/core/time/dates';
import { pastDay } from '@/core/time/due';
import { t } from '@/strings';
import type { PantryItem } from './schema';

export type ExpiryState = 'expired' | 'soon' | 'ok' | 'none';

/** Days until the best-before date (negative = expired); undefined without a date. */
export const daysLeft = (item: Pick<PantryItem, 'expires'>, today: string): number | undefined =>
  item.expires ? daysBetween(today, item.expires) : undefined;

/**
 * The page's best-before line. An expired item names its day like every overdue label (N08,
 * `core/time/due.ts`): „MHD war Mo.“ within the last week, the date before that – never a count
 * of days that grows every day.
 */
export function expiryText(
  item: Pick<PantryItem, 'expires'>,
  today: string,
  soonDays: number,
): string | null {
  const d = daysLeft(item, today);
  if (d === undefined) return null;
  if (d < 0) return capitalize(t.pantry.expiredOn(pastDay(item.expires!, today)));
  if (d === 0) return t.pantry.today;
  if (d <= soonDays) return t.pantry.inDays(d);
  return t.pantry.until(formatDay(item.expires!, 'dd.MM.yyyy'));
}

/** Empty stock never expires: there is nothing left that could spoil. */
export function expiryState(item: PantryItem, today: string, soonDays: number): ExpiryState {
  const d = daysLeft(item, today);
  if (d === undefined || item.count === 0) return 'none';
  if (d < 0) return 'expired';
  return d <= soonDays ? 'soon' : 'ok';
}

/** Stock at or below the chosen minimum (also when it is used up and a minimum is set). */
export const needsRestock = (item: PantryItem): boolean =>
  item.minCount !== undefined ? item.count <= item.minCount : item.count === 0;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Added within the last day: the widget does not call it "running low" yet – a fresh entry with
 * count 0 is usually still being filled in, not a shopping reminder.
 */
export const isFresh = (item: { createdAt: number }): boolean =>
  Date.now() - item.createdAt < DAY_MS;

/**
 * The widget's context line. With nothing expiring it says so first and only then what runs low,
 * so a short stock never reads like an alarm (FOCUS-GUIDELINES: calm wording).
 */
export function widgetLine(expired: number, soon: number, low: number): string {
  if (expired + soon + low === 0) return t.pantry.shelf.summaryFine;
  if (expired + soon === 0) return t.pantry.shelf.onlyLow(low);
  return t.pantry.shelf.summary(expired, soon, low);
}

const RANK: Record<ExpiryState, number> = { expired: 0, soon: 1, ok: 2, none: 3 };

/** Expired first, then soon, then by date; items without a date by name. */
export function sortItems<T extends PantryItem>(
  items: readonly T[],
  today: string,
  soonDays: number,
): T[] {
  return [...items].sort(
    (a, b) =>
      RANK[expiryState(a, today, soonDays)] - RANK[expiryState(b, today, soonDays)] ||
      (a.expires ?? '9999').localeCompare(b.expires ?? '9999') ||
      compareText(a.name, b.name),
  );
}

export type Filter = 'all' | 'expiring' | 'restock';

export function applyFilter<T extends PantryItem>(
  items: readonly T[],
  f: Filter,
  today: string,
  soonDays: number,
): T[] {
  if (f === 'expiring')
    return items.filter((i) => ['expired', 'soon'].includes(expiryState(i, today, soonDays)));
  if (f === 'restock') return items.filter(needsRestock);
  return [...items];
}

/** Whole numbers only, 0 up to 9999; anything else is rejected. */
export function parseCount(text: string): number | undefined {
  const v = text.trim();
  if (!/^\d{1,4}$/.test(v)) return undefined;
  return Number(v);
}

/** The count with its unit, e.g. "2 kg"; `fallback` formats a bare count (the pieces wording). */
export const countLabel = (
  item: Pick<PantryItem, 'count' | 'unit'>,
  fallback: (n: number) => string,
): string => (item.unit ? `${item.count} ${item.unit}` : fallback(item.count));

/** True when taking one away moved the stock from above the minimum down to it (or below). */
export const crossedMinimum = (item: PantryItem, next: number): boolean =>
  item.minCount !== undefined && item.count > item.minCount && next <= item.minCount;

/** EAN-8, UPC-A (12) or EAN-13 digits with a correct check digit. */
export function isEan(code: string): boolean {
  if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  // From the right (before the check digit) the weights are 3, 1, 3, 1 …
  const sum = digits.reverse().reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** The item that carries this barcode, if any. */
export const findByEan = <T extends Pick<PantryItem, 'ean'>>(
  items: readonly T[],
  code: string,
): T | undefined => items.find((i) => i.ean === code);
