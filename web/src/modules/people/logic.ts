import { compareText } from '@/core/i18n/format';
import { capitalize, relativeDays } from '@/core/i18n/format';
import { t } from '@/strings';
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
    return da === db ? compareText(a.name, b.name) : da < db ? -1 : 1;
  });
}

/** "Anna wird 30" or "Geburtstag: Anna". */
export function birthdayTitle(name: string, b: Birthday, date: string): string {
  const age = ageOn(b, date);
  return age !== undefined && age > 0 ? t.people.turnsAge(name, age) : t.people.birthdayOf(name);
}

/** "Heute", "Morgen", "in 5 Tagen" (UI language). */
export function whenLabel(days: number): string {
  return Math.abs(days) <= 1 ? capitalize(relativeDays(days)) : relativeDays(days);
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
      compareText(a.title, b.title),
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

/** Gifts that are not given yet (idea or bought) across all people, in the usual gift order, each with its person. Gifts of a missing person are left out. */
export function openGiftsWithPerson<G extends Gift, P extends { id: string }>(
  gifts: readonly G[],
  people: readonly P[],
): { gift: G; person: P }[] {
  const byId = new Map(people.map((p) => [p.id, p]));
  return sortGifts(gifts.filter((g) => g.status !== 'given')).flatMap((gift) => {
    const person = byId.get(gift.personId);
    return person ? [{ gift, person }] : [];
  });
}

export interface CongratsLink {
  id: 'whatsapp' | 'tel' | 'mail';
  url: string;
}

/**
 * Ways to congratulate. WhatsApp always works (the contact is picked there unless a number is known),
 * a phone call and a mail only with the matching detail. Only digits and "+" survive in a number, a mail
 * address must look like one: nothing typed in a note can turn into another kind of link.
 */
export function congratsLinks(
  person: Pick<Person, 'phone' | 'email'>,
  text: string,
  subject: string,
): CongratsLink[] {
  const digits = (person.phone ?? '').replace(/[^\d+]/g, '');
  const phone = /^\+?\d{5,}$/.test(digits) ? digits : undefined;
  const mail =
    person.email && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(person.email)
      ? person.email
      : undefined;
  return [
    {
      id: 'whatsapp',
      url: phone
        ? `https://wa.me/${phone.replace('+', '')}?text=${encodeURIComponent(text)}`
        : `https://wa.me/?text=${encodeURIComponent(text)}`,
    },
    ...(phone ? [{ id: 'tel' as const, url: `tel:${phone}` }] : []),
    ...(mail
      ? [
          {
            id: 'mail' as const,
            url: `mailto:${mail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
          },
        ]
      : []),
  ];
}

/** One or two capital letters for the avatar: first letters of the first and the last word. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = [...words[0]!][0]!;
  const last = words.length > 1 ? [...words[words.length - 1]!][0]! : '';
  return (first + last).toLocaleUpperCase();
}

/** How close the birthday is as 0..1 for the ring (1 = today, 0 = a month or more away). */
export const closeness = (days: number, window = 30): number =>
  Math.max(0, Math.min(1, 1 - days / window));

/** Budget left for the person: budget minus what was bought or given (may be negative). */
export const budgetLeft = (budgetCents: number, gifts: readonly Gift[]): number =>
  budgetCents - totals(gifts).spentCents;
