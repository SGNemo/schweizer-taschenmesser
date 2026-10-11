import { compareText } from '@/core/i18n/format';
import { daysBetween } from '@/core/time/dates';
import type { PantryItem } from './schema';

export type ExpiryState = 'expired' | 'soon' | 'ok' | 'none';

/** Days until the best-before date (negative = expired); undefined without a date. */
export const daysLeft = (item: Pick<PantryItem, 'expires'>, today: string): number | undefined =>
  item.expires ? daysBetween(today, item.expires) : undefined;

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
