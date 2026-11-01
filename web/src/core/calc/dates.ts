import {
  DATE_RE,
  addDaysStr,
  addMonthsStr,
  daysBetween,
  isoWeekday,
  parseDate,
  today,
} from '@/core/time/dates';
import { getISOWeek } from 'date-fns';

export const isValidDate = (s: string): boolean =>
  DATE_RE.test(s) && !Number.isNaN(parseDate(s).getTime()) && addDaysStr(s, 0) === s;

/** Signed days from `a` to `b`, plus the split into whole weeks and remaining days. */
export function difference(
  a: string,
  b: string,
): { days: number; weeks: number; rest: number } | undefined {
  if (!isValidDate(a) || !isValidDate(b)) return undefined;
  const days = daysBetween(a, b);
  const abs = Math.abs(days);
  return { days, weeks: Math.floor(abs / 7), rest: abs % 7 };
}

export function addDays(start: string, days: number): string | undefined {
  if (!isValidDate(start) || !Number.isInteger(days) || Math.abs(days) > 365_000) return undefined;
  return addDaysStr(start, days);
}

/** ISO weekday (1 = Monday) and ISO calendar week number of a date. */
export function weekInfo(date: string): { weekday: number; week: number } | undefined {
  if (!isValidDate(date)) return undefined;
  return { weekday: isoWeekday(date), week: getISOWeek(parseDate(date)) };
}

// --- Calculator: months, working days and date phrases ------------------------------------------

/** `start` plus (or minus) whole months; the day is clamped to the month's end (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(start: string, months: number): string | undefined {
  if (!isValidDate(start) || !Number.isInteger(months) || Math.abs(months) > 12_000) {
    return undefined;
  }
  return addMonthsStr(start, months);
}

const isWorkday = (d: string): boolean => isoWeekday(d) <= 5;

/**
 * Working days (Monday to Friday) from `a` up to, but not including, `b`; negative when `b` is before
 * `a`. `holidays` (YYYY-MM-DD) are skipped. Public holidays are not guessed: they differ by region.
 */
export function workdaysBetween(
  a: string,
  b: string,
  holidays: readonly string[] = [],
): number | undefined {
  if (!isValidDate(a) || !isValidDate(b)) return undefined;
  if (Math.abs(daysBetween(a, b)) > 366_000) return undefined;
  const skip = new Set(holidays);
  const [from, to, sign] = a <= b ? [a, b, 1] : [b, a, -1];
  let n = 0;
  for (let d = from; d < to; d = addDaysStr(d, 1)) if (isWorkday(d) && !skip.has(d)) n++;
  return n * sign;
}

/** The date `n` working days after (or before) `start`; weekends and `holidays` are skipped. */
export function addWorkdays(
  start: string,
  n: number,
  holidays: readonly string[] = [],
): string | undefined {
  if (!isValidDate(start) || !Number.isInteger(n) || Math.abs(n) > 100_000) return undefined;
  const skip = new Set(holidays);
  const step = n < 0 ? -1 : 1;
  let d = start;
  for (let left = Math.abs(n); left > 0;) {
    d = addDaysStr(d, step);
    if (isWorkday(d) && !skip.has(d)) left--;
  }
  return d;
}

/** Reads a date the way people type it: 2026-03-15, 15.03.2026, 15.03., 15/03/2026, "heute", "today". */
export function parseDateInput(text: string, ref: string = today()): string | undefined {
  const s = text.trim().toLowerCase();
  if (['heute', 'today', 'hoy', "aujourd'hui", 'hoje'].includes(s)) return ref;
  if (['morgen', 'tomorrow', 'mañana', 'demain', 'amanhã'].includes(s)) return addDaysStr(ref, 1);
  let y: string | undefined;
  let m: string | undefined;
  let d: string | undefined;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  const dmy = /^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})?$/.exec(s);
  if (iso) [, y, m, d] = iso;
  else if (dmy) [, d, m, y] = dmy;
  else return undefined;
  const year = y === undefined ? ref.slice(0, 4) : y.length === 2 ? `20${y}` : y;
  const out = `${year}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  return isValidDate(out) ? out : undefined;
}

type PhraseUnit = 'day' | 'week' | 'month' | 'year' | 'workday';
const UNIT_WORDS: Array<[PhraseUnit, RegExp]> = [
  [
    'workday',
    /^(?:arbeitstage?|werktage?|workdays?|working days?|business days?|jours? ouvr[ée]s?|d[ií]as? h[áa]biles|d[ií]as? [úu]teis)$/,
  ],
  ['day', /^(?:tage?n?|tg|days?|d|jours?|j|d[ií]as?|dias?)$/],
  ['week', /^(?:wochen?|wo|weeks?|w|semaines?|semanas?|semana)$/],
  ['month', /^(?:monate?n?|mon|months?|mois|mes(?:es)?|m[êe]s(?:es)?)$/],
  ['year', /^(?:jahre?n?|years?|y|ans?|an|a[ñn]os?|anos?)$/],
];
const unitOf = (word: string): PhraseUnit | undefined =>
  UNIT_WORDS.find(([, re]) => re.test(word.toLowerCase()))?.[0];

export interface DateAnswer {
  /** "15.03.2026 + 45 Tage = Montag, 29. Mai 2026" */
  text: string;
  /** YYYY-MM-DD or a count, for copying. */
  copy: string;
}

const DATE_TOKEN = String.raw`[0-9]{1,4}[./-][0-9]{1,2}(?:[./-][0-9]{2,4})?\.?|heute|today|morgen|tomorrow|hoy|ma[ñn]ana|hoje|demain`;
const ADD = new RegExp(`^(${DATE_TOKEN})\\s*([+\\-−–])\\s*([0-9]+)\\s*([a-zäöüéíúçñ ]+?)$`, 'i');
const SPAN = new RegExp(
  `^(${DATE_TOKEN})\\s+(?:bis|to|until|hasta|[àa]|at[ée])\\s+(${DATE_TOKEN})$`,
  'i',
);

/** Day count and date as typed into the search bar (formatting by the caller's locale). */
export function datePhrase(
  query: string,
  ref: string = today(),
  describe: (date: string) => string = (d) => d,
  between: (days: number) => string = String,
): DateAnswer | undefined {
  const q = query.trim().replace(/^=\s*/, '');
  const add = ADD.exec(q);
  if (add) {
    const start = parseDateInput(add[1]!, ref);
    const unit = unitOf(add[4]!.trim());
    if (!start || !unit) return undefined;
    const n = Number(add[3]) * (/[-−–]/.test(add[2]!) ? -1 : 1);
    const end =
      unit === 'day'
        ? addDays(start, n)
        : unit === 'week'
          ? addDays(start, n * 7)
          : unit === 'month'
            ? addMonths(start, n)
            : unit === 'year'
              ? addMonths(start, n * 12)
              : addWorkdays(start, n);
    return end ? { text: `${q} = ${describe(end)}`, copy: end } : undefined;
  }
  const span = SPAN.exec(q);
  if (span) {
    const a = parseDateInput(span[1]!, ref);
    const b = parseDateInput(span[2]!, ref);
    const d = a && b ? difference(a, b) : undefined;
    return d ? { text: `${q} = ${between(d.days)}`, copy: String(d.days) } : undefined;
  }
  return undefined;
}
