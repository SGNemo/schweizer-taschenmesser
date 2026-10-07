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
/** Sorting for names and titles in the current language (case- and accent-aware). */
export function collator(): Intl.Collator {
  const lang = getLang();
  let c = collators.get(lang);
  if (!c) {
    c = new Intl.Collator(lang, { sensitivity: 'base', numeric: true });
    collators.set(lang, c);
  }
  return c;
}

/** `a.localeCompare(b)` in the current language. */
export const compareText = (a: string, b: string): number => collator().compare(a, b);

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
