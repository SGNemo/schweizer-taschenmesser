import { useSyncExternalStore } from 'react';
import { getLang, useLang, type Lang } from './lang';

/**
 * Locale for dates, times and numbers. By default it follows the UI language (English → British
 * conventions, as the currency is the euro); a person can pick another region on this device
 * (Settings → Allgemein). The currency itself never changes: amounts are euro cents.
 */
export const FORMAT_REGIONS = [
  'de-DE',
  'de-AT',
  'de-CH',
  'en-GB',
  'en-IE',
  'en-US',
  'es-ES',
  'fr-FR',
  'pt-BR',
  'pt-PT',
] as const;
export type FormatRegion = (typeof FORMAT_REGIONS)[number];
export type FormatPref = 'auto' | FormatRegion;

const DEFAULT_REGION: Record<Lang, FormatRegion> = {
  de: 'de-DE',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
  'pt-BR': 'pt-BR',
};

const KEY = 'tm-format';
const isFormatPref = (v: unknown): v is FormatPref =>
  v === 'auto' || FORMAT_REGIONS.includes(v as FormatRegion);

function readPref(): FormatPref {
  try {
    const v = localStorage.getItem(KEY);
    return isFormatPref(v) ? v : 'auto';
  } catch {
    return 'auto';
  }
}

let pref: FormatPref = readPref();
const listeners = new Set<() => void>();

export const getFormatPref = (): FormatPref => pref;
export const defaultRegion = (lang: Lang): FormatRegion => DEFAULT_REGION[lang];

/** BCP 47 locale for `Intl` and date-fns. */
export function formatLocale(lang: Lang = getLang()): FormatRegion {
  return pref === 'auto' ? DEFAULT_REGION[lang] : pref;
}

export function setFormatPref(next: FormatPref): void {
  pref = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // private mode: lasts for this session
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useFormatPref = (): FormatPref =>
  useSyncExternalStore(subscribe, getFormatPref, getFormatPref);

/** Current format locale; re-renders on a language or region change. */
export function useFormatLocale(): FormatRegion {
  const lang = useLang();
  const p = useFormatPref();
  return p === 'auto' ? DEFAULT_REGION[lang] : p;
}

const collators = new Map<string, Intl.Collator>();
/** Sorting for names and titles in the current language (like `localeCompare(…, lang)`). */
export function collator(options?: Intl.CollatorOptions): Intl.Collator {
  const lang = getLang();
  const id = `${lang}|${JSON.stringify(options ?? {})}`;
  let c = collators.get(id);
  if (!c) {
    c = new Intl.Collator(lang, options);
    collators.set(id, c);
  }
  return c;
}

/** `a.localeCompare(b, lang)` in the current UI language. */
export const compareText = (a: string, b: string, options?: Intl.CollatorOptions): number =>
  collator(options).compare(a, b);

const plurals = new Map<string, Intl.PluralRules>();
/** CLDR plural category of `n` in the current language (`one`, `few`, `many`, `other`, …). */
export function pluralCategory(n: number, lang: Lang = getLang()): Intl.LDMLPluralRule {
  let p = plurals.get(lang);
  if (!p) {
    p = new Intl.PluralRules(lang);
    plurals.set(lang, p);
  }
  return p.select(n);
}

/**
 * Picks the form for `n` (ICU plural categories; `other` is required, the rest optional).
 * `#` in the chosen form is replaced by `n` formatted for the current locale.
 */
export function plural(
  n: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
  lang: Lang = getLang(),
): string {
  const form = (n === 0 && forms.zero) || forms[pluralCategory(n, lang)] || forms.other;
  return form.replace(/#/g, new Intl.NumberFormat(formatLocale(lang)).format(n));
}

/** Region names in the UI language (Intl, nothing to translate). */
export function regionLabel(region: FormatRegion, lang: Lang = getLang()): string {
  const [language = region, country = region] = region.split('-');
  try {
    const regionName = new Intl.DisplayNames([lang], { type: 'region' }).of(country) ?? country;
    const languageName =
      new Intl.DisplayNames([lang], { type: 'language' }).of(language) ?? language;
    return `${regionName} (${languageName})`;
  } catch {
    return region;
  }
}

const numberFormats = new Map<string, Intl.NumberFormat>();
/** `Intl.NumberFormat` for the current format locale (cached per locale and options). */
export function numberFormat(options: Intl.NumberFormatOptions = {}): Intl.NumberFormat {
  const locale = formatLocale();
  const id = `${locale}|${JSON.stringify(options)}`;
  let f = numberFormats.get(id);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    numberFormats.set(id, f);
  }
  return f;
}

/** A number in the current format locale, e.g. 1234.5 → "1.234,5" / "1,234.5". */
export const formatNumber = (n: number, options?: Intl.NumberFormatOptions): string =>
  numberFormat(options).format(n);

const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();
/**
 * `Intl.DateTimeFormat` for dates and times: names (months, weekdays) in the UI language, order and
 * separators from the format region when it speaks the same language.
 */
export function dateTimeFormat(options: Intl.DateTimeFormatOptions = {}): Intl.DateTimeFormat {
  const locale = dateLocale();
  const id = `${locale}|${JSON.stringify(options)}`;
  let f = dateTimeFormats.get(id);
  if (!f) {
    f = new Intl.DateTimeFormat(locale, options);
    dateTimeFormats.set(id, f);
  }
  return f;
}

/** Numeric date and time, like `toLocaleString()` ("7.10.2026, 14:30:05"). */
export const DATE_TIME_NUMERIC: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
};

/** Date and time of an epoch timestamp, e.g. "7. Okt. 2026, 14:30" (medium date, short time). */
export const formatTimestamp = (
  at: number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string => dateTimeFormat(options).format(at);

/**
 * Locale for date texts: the format region if it speaks the UI language (de-CH for German UI),
 * otherwise the UI language's default region, so month and weekday names always match the UI.
 */
export function dateLocale(lang: Lang = getLang()): FormatRegion {
  const region = formatLocale(lang);
  const sameLanguage = region.split('-')[0] === lang.split('-')[0];
  return sameLanguage ? region : DEFAULT_REGION[lang];
}

/** Decimal separator of the current format locale ("," or "."). */
export function decimalSeparator(): string {
  return (
    numberFormat()
      .formatToParts(1.5)
      .find((p) => p.type === 'decimal')?.value ?? ','
  );
}

const relativeFormats = new Map<string, Intl.RelativeTimeFormat>();
/**
 * "heute" / "morgen" / "gestern" for the next and previous day, otherwise "in 6 Tagen" /
 * "vor 2 Tagen" (Intl, in the UI language; no "vorgestern").
 */
export function relativeDays(days: number, lang: Lang = getLang()): string {
  const numeric = Math.abs(days) <= 1 ? 'auto' : 'always';
  const id = `${lang}|${numeric}`;
  let f = relativeFormats.get(id);
  if (!f) {
    f = new Intl.RelativeTimeFormat(lang, { numeric });
    relativeFormats.set(id, f);
  }
  return f.format(days, 'day');
}

/** First letter upper case in the UI language ("heute" → "Heute"). */
export const capitalize = (s: string, lang: Lang = getLang()): string =>
  s ? s.charAt(0).toLocaleUpperCase(lang) + s.slice(1) : s;
