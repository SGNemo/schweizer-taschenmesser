/**
 * Calendar-date helpers on 'YYYY-MM-DD' strings (local time, no timezone pitfalls).
 * Date-only values are stored as strings everywhere; Date objects only exist inside these helpers.
 */
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  format,
  getISODay,
  startOfISOWeek,
} from 'date-fns';
import { de, enGB, enIE, enUS, es, fr, ptBR, pt, deAT, type Locale } from 'date-fns/locale';
import { capitalize, dateLocale, relativeDays } from '@/core/i18n/format';
import { getLang, type Lang } from '@/core/i18n/lang';
import { t } from '@/strings';
import { now, pad2, toDateString, today } from './now';

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export const addDaysStr = (s: string, n: number): string => toDateString(addDays(parseDate(s), n));
export const addMonthsStr = (s: string, n: number): string =>
  toDateString(addMonths(parseDate(s), n));
export const daysBetween = (a: string, b: string): number =>
  differenceInCalendarDays(parseDate(b), parseDate(a));
/** ISO weekday: Monday = 1 … Sunday = 7. */
export const isoWeekday = (s: string): number => getISODay(parseDate(s));
/** Start of the week containing `s`: Monday (default, ISO) or Sunday (`weekStart` 7). */
export const startOfWeekStr = (s: string, weekStart: 1 | 7 = 1): string => {
  const monday = startOfISOWeek(parseDate(s));
  // Sunday-first weeks start the day before that week's Monday (Sunday itself belongs to the next).
  if (weekStart === 7)
    return toDateString(isoWeekday(s) === 7 ? parseDate(s) : addDays(monday, -1));
  return toDateString(monday);
};
export const startOfMonthStr = (s: string): string => `${s.slice(0, 7)}-01`;
export const endOfMonthStr = (s: string): string =>
  toDateString(new Date(parseDate(s).getFullYear(), parseDate(s).getMonth() + 1, 0));
/** 'YYYY-MM' of a date string. */
export const monthOf = (s: string): string => s.slice(0, 7);
export const addMonthsToMonth = (month: string, n: number): string =>
  monthOf(addMonthsStr(`${month}-01`, n));
export const formatMonth = (month: string): string => formatDay(`${month}-01`, 'LLLL yyyy');

export const tomorrow = (): string => addDaysStr(today(), 1);

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDaysStr(d, 1)) out.push(d);
  return out;
}

const DATE_FNS: Record<string, Locale> = {
  'de-DE': de,
  'de-AT': deAT,
  'de-CH': de,
  'en-GB': enGB,
  'en-IE': enIE,
  'en-US': enUS,
  'es-ES': es,
  'fr-FR': fr,
  'pt-BR': ptBR,
  'pt-PT': pt,
};

/**
 * The code writes date patterns in German style; each language has its own equivalent (word order,
 * "de", no period after the day). Numeric dates follow the format region. Unknown patterns are used
 * as they are, with the language's month and weekday names.
 */
const PATTERNS: Record<string, Partial<Record<Lang | 'en-US', string>>> = {
  'd. MMM yyyy': {
    en: 'd MMM yyyy',
    'en-US': 'MMM d, yyyy',
    es: 'd MMM yyyy',
    fr: 'd MMM yyyy',
    'pt-BR': "d 'de' MMM 'de' yyyy",
  },
  'd. MMMM yyyy': {
    en: 'd MMMM yyyy',
    'en-US': 'MMMM d, yyyy',
    es: "d 'de' MMMM 'de' yyyy",
    fr: 'd MMMM yyyy',
    'pt-BR': "d 'de' MMMM 'de' yyyy",
  },
  'EEEE, d. MMMM': {
    en: 'EEEE d MMMM',
    'en-US': 'EEEE, MMMM d',
    es: "EEEE, d 'de' MMMM",
    fr: 'EEEE d MMMM',
    'pt-BR': "EEEE, d 'de' MMMM",
  },
  'EEEE, d. MMMM yyyy': {
    en: 'EEEE d MMMM yyyy',
    'en-US': 'EEEE, MMMM d, yyyy',
    es: "EEEE, d 'de' MMMM 'de' yyyy",
    fr: 'EEEE d MMMM yyyy',
    'pt-BR': "EEEE, d 'de' MMMM 'de' yyyy",
  },
  'EEE, d. MMM yyyy': {
    en: 'EEE d MMM yyyy',
    'en-US': 'EEE, MMM d, yyyy',
    es: 'EEE, d MMM yyyy',
    fr: 'EEE d MMM yyyy',
    'pt-BR': "EEE, d 'de' MMM 'de' yyyy",
  },
  'EEE, d. MMMM': {
    en: 'EEE d MMMM',
    'en-US': 'EEE, MMMM d',
    es: "EEE, d 'de' MMMM",
    fr: 'EEE d MMMM',
    'pt-BR': "EEE, d 'de' MMMM",
  },
  'EEE, d. MMM': {
    en: 'EEE d MMM',
    'en-US': 'EEE, MMM d',
    es: 'EEE, d MMM',
    fr: 'EEE d MMM',
    'pt-BR': "EEE, d 'de' MMM",
  },
  'd. MMM': { en: 'd MMM', 'en-US': 'MMM d', es: 'd MMM', fr: 'd MMM', 'pt-BR': "d 'de' MMM" },
  'LLLL yyyy': { es: "LLLL 'de' yyyy", 'pt-BR': "LLLL 'de' yyyy" },
};

/** Numeric day.month.year in the format region's order and separators. */
const NUMERIC: Record<string, string> = {
  de: 'dd.MM.yyyy',
  'en-US': 'MM/dd/yyyy',
  default: 'dd/MM/yyyy',
};

function localPattern(pattern: string, locale: string, lang: Lang): string {
  if (pattern === 'dd.MM.yyyy') {
    if (locale.startsWith('de')) return NUMERIC.de!;
    return NUMERIC[locale] ?? NUMERIC.default!;
  }
  if (lang === 'de') return pattern;
  const variants = PATTERNS[pattern];
  if (!variants) return pattern;
  return (locale === 'en-US' ? variants['en-US'] : undefined) ?? variants[lang] ?? pattern;
}

/**
 * Locale-formatted date in the UI language, e.g. formatDay('2026-09-29', 'EEEE, d. MMMM') →
 * "Dienstag, 29. September" / "Tuesday 29 September". Patterns are written in German style.
 */
export function formatDay(s: string, pattern: string): string {
  const lang = getLang();
  const locale = dateLocale(lang);
  return format(parseDate(s), localPattern(pattern, locale, lang), {
    locale: DATE_FNS[locale] ?? de,
  });
}

/** "Heute" / "Morgen" / "Gestern" or a short weekday date. */
export function relativeDayLabel(s: string, ref: string = today()): string {
  const diff = daysBetween(ref, s);
  if (Math.abs(diff) <= 1) return capitalize(relativeDays(diff));
  return formatDay(s, 'EEE, d. MMM');
}

/**
 * What a date means in words, for form hints: "Heute", or weekday plus distance
 * ("Montag, in 6 Tagen", "Mittwoch, morgen", "Sonntag, vor 2 Tagen").
 */
export function humanDateHint(s: string, ref: string = today()): string {
  const diff = daysBetween(ref, s);
  if (diff === 0) return capitalize(relativeDays(0));
  return t.time.weekdayAndDistance(formatDay(s, 'EEEE'), relativeDays(diff));
}

/** Epoch ms of a local date + 'HH:mm'. */
export function toEpoch(date: string, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = parseDate(date);
  d.setHours(h!, m!, 0, 0);
  return d.getTime();
}

/** Local "d. MMM HH:mm" of an epoch timestamp, e.g. "31. Jan. 23:30" (day and time from the same local clock). */
export function formatDateTime(at: number): string {
  const d = new Date(at);
  return `${formatDay(toDateString(d), 'd. MMM')} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function nowTime(): string {
  const d = new Date(now());
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export { pad2, today, toDateString };
