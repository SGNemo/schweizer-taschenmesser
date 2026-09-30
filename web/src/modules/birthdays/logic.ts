import { addDaysStr, daysBetween, pad2 } from '@/core/time/dates';
import type { Birthday } from './schema';

type B = Pick<Birthday, 'month' | 'day' | 'year'>;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Birthday in a given year as 'YYYY-MM-DD'; 29 February falls back to 28 February in common years. */
export function dateInYear(b: B, year: number): string {
  const day = b.month === 2 && b.day === 29 && !isLeap(year) ? 28 : b.day;
  return `${year}-${pad2(b.month)}-${pad2(day)}`;
}

/** First birthday on or after `from` ('YYYY-MM-DD'). */
export function nextBirthday(b: B, from: string): string {
  const year = Number(from.slice(0, 4));
  const thisYear = dateInYear(b, year);
  return thisYear >= from ? thisYear : dateInYear(b, year + 1);
}

/** Age turned on the given birthday date, if the birth year is known. */
export function ageOn(b: B, date: string): number | undefined {
  return b.year === undefined ? undefined : Number(date.slice(0, 4)) - b.year;
}

export const daysUntil = (b: B, from: string): number => daysBetween(from, nextBirthday(b, from));

/** All birthday dates within [from, to]. */
export function birthdaysInRange(b: B, from: string, to: string): string[] {
  const out: string[] = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    const date = dateInYear(b, y);
    if (date >= from && date <= to && (b.year === undefined || y >= b.year)) out.push(date);
  }
  return out;
}

/** Soonest first; ties alphabetical. */
export function sortByNext<T extends B & { name: string }>(list: readonly T[], from: string): T[] {
  return [...list].sort(
    (a, b) => daysUntil(a, from) - daysUntil(b, from) || a.name.localeCompare(b.name, 'de'),
  );
}

/** "Anna wird 30" or "Geburtstag: Anna". */
export function titleFor(b: B & { name: string }, date: string): string {
  const age = ageOn(b, date);
  return age !== undefined && age > 0 ? `${b.name} wird ${age}` : `Geburtstag: ${b.name}`;
}

export function whenLabel(days: number): string {
  if (days === 0) return 'Heute';
  if (days === 1) return 'Morgen';
  return `in ${days} Tagen`;
}

export const dayBefore = (date: string, n: number): string => addDaysStr(date, -n);
