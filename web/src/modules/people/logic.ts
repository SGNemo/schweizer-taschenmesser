import { addDaysStr, daysBetween, pad2 } from '@/core/time/dates';
import type { Birthday, Gift, GiftStatus, Person } from './schema';

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Birthday in a given year as 'YYYY-MM-DD'; 29 February falls back to 28 February in common years. */
export function dateInYear(b: Pick<Birthday, 'month' | 'day'>, year: number): string {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return `${year}-${pad2(b.month)}-${pad2(day)}`;
}

/** First birthday on or after `from` ('YYYY-MM-DD'). */
export function nextBirthday(b: Birthday, from: string): string {
  const year = Number(from.slice(0, 4));
  const thisYear = dateInYear(b, year);
  return thisYear >= from ? thisYear : dateInYear(b, year + 1);
}

/** Age turned on the given birthday date, if the birth year is known. */
export function ageOn(b: Birthday, date: string): number | undefined {
  return b.year === undefined ? undefined : Number(date.slice(0, 4)) - b.year;
}

export const daysUntil = (b: Birthday, from: string): number =>
  daysBetween(from, nextBirthday(b, from));

/** All birthday dates within [from, to]. */
export function birthdaysInRange(b: Birthday, from: string, to: string): string[] {
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const date = dateInYear(b, y);
    if (date >= from && date <= to && (b.year === undefined || y >= b.year)) out.push(date);
  }
  return out;
}

/** Soonest birthday first; people without a birthday last, alphabetical. */
export function sortByNext<T extends Pick<Person, 'name' | 'birthday'>>(
  list: readonly T[],
  from: string,
): T[] {
  const days = (p: T) => (p.birthday ? daysUntil(p.birthday, from) : Number.POSITIVE_INFINITY);
  return [...list].sort((a, b) => {
    const da = days(a);
    const db = days(b);
    return da === db ? a.name.localeCompare(b.name, 'de') : da < db ? -1 : 1;
  });
}

/** "Anna wird 30" or "Geburtstag: Anna". */
export function birthdayTitle(name: string, b: Birthday, date: string): string {
  const age = ageOn(b, date);
  return age !== undefined && age > 0 ? `${name} wird ${age}` : `Geburtstag: ${name}`;
}

export function whenLabel(days: number): string {
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  return `in ${days} Tagen`;
}

export const dayBefore = (date: string, n: number): string => addDaysStr(date, -n);

/** Only http(s) links are kept (a "javascript:" link in a shared backup must never be clickable). */
export function safeUrl(input: string): string | undefined {
  const v = input.trim();
  if (!v) return undefined;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

const RANK: Record<GiftStatus, number> = { idea: 0, bought: 1, given: 2 };

/** Open ideas first, then bought, then given; inside a status by occasion date, then title. */
export function sortGifts<T extends Gift>(gifts: readonly T[]): T[] {
  return [...gifts].sort(
    (a, b) =>
      RANK[a.status] - RANK[b.status] ||
      (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
      a.title.localeCompare(b.title, 'de'),
  );
}

export interface Totals {
  open: number;
  bought: number;
  given: number;
  /** Sum of the prices of bought and given gifts, in cents. */
  spentCents: number;
}

export function totals(gifts: readonly Gift[]): Totals {
  const t: Totals = { open: 0, bought: 0, given: 0, spentCents: 0 };
  for (const g of gifts) {
    if (g.status === 'idea') t.open++;
    else {
      if (g.status === 'bought') t.bought++;
      else t.given++;
      t.spentCents += g.priceCents ?? 0;
    }
  }
  return t;
}

/** Gifts that still need action (idea or bought, not yet given). */
export const openGifts = <T extends Gift>(gifts: readonly T[]): T[] =>
  gifts.filter((g) => g.status !== 'given');
