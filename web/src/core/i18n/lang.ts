import { useSyncExternalStore } from 'react';

/**
 * UI language of this device. The choice stays in `localStorage` (like the other per-device
 * choices), not in the synced settings. "System" follows the device language; anything the app
 * does not speak falls back to English. German is the source language of every text.
 */
export const LANGS = ['de', 'en', 'es', 'fr', 'pt-BR'] as const;
export type Lang = (typeof LANGS)[number];
/** What the person picked: a language or "follow the device". */
export type LangPref = Lang | 'system';
export const SOURCE_LANG: Lang = 'de';
/** Names of the languages in their own language (never translated). */
export const LANG_NAMES: Record<Lang, string> = {
  de: 'Deutsch',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  'pt-BR': 'Português (Brasil)',
};
export const FALLBACK_LANG: Lang = 'en';

const KEY = 'tm-lang';

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);
export const isLangPref = (v: unknown): v is LangPref => v === 'system' || isLang(v);

/** Best supported language for a list of BCP 47 tags (`navigator.languages`), English otherwise. */
export function matchLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    const exact = LANGS.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    const base = lower.split('-')[0];
    // Any Portuguese is served the Brazilian translation; any German, English, Spanish, French the one we have.
    const byBase = LANGS.find((l) => l.toLowerCase().split('-')[0] === base);
    if (byBase) return byBase;
  }
  return FALLBACK_LANG;
}

export function systemLang(): Lang {
  if (typeof navigator === 'undefined') return FALLBACK_LANG;
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  return matchLang(tags.filter(Boolean));
}

/** Stored preference; nothing stored means "system". */
export function readLangPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY);
    return isLangPref(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Whether a preference was stored at all (an older installation stores none). */
export function hasStoredLangPref(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export const resolveLang = (pref: LangPref): Lang => (pref === 'system' ? systemLang() : pref);

let pref: LangPref = readLangPref();
let current: Lang = resolveLang(pref);
const listeners = new Set<() => void>();
/** Runs before listeners are told about a switch (loads the catalog of the new language). */
let prepare: (lang: Lang) => Promise<void> = async () => {};

export const getLang = (): Lang => current;
export const getLangPref = (): LangPref => pref;

/** Called once by the catalog layer so a switch never shows a half-loaded language. */
export function setLangLoader(loader: (lang: Lang) => Promise<void>): void {
  prepare = loader;
}

function apply(next: Lang): void {
  current = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  listeners.forEach((l) => l());
}

/** Picks a language (or "system"), loads its texts and switches the UI without a restart. */
export async function setLangPref(next: LangPref): Promise<void> {
  pref = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // private mode: the choice then lasts for this session only
  }
  const lang = resolveLang(next);
  await prepare(lang);
  apply(lang);
}

/** Synchronous switch for code that already has the catalog (tests, the German source). */
export function setLang(lang: Lang): void {
  pref = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // see setLangPref
  }
  apply(lang);
}

/**
 * Startup: an installation that already has data but never stored a choice was German-only, so it
 * keeps German instead of suddenly following an English device. New installations follow the device.
 */
export async function initLang(hasExistingData: () => Promise<boolean>): Promise<void> {
  if (!hasStoredLangPref()) {
    // Decided once: later starts must not mistake the new installation's own data for an old one.
    pref = (await hasExistingData().catch(() => false)) ? 'de' : 'system';
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      // see setLangPref
    }
  }
  const lang = resolveLang(pref);
  await prepare(lang);
  apply(lang);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Current language; re-renders on a switch. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);
/** Current preference ("system" or a language); re-renders on a switch. */
export const useLangPref = (): LangPref =>
  useSyncExternalStore(subscribe, getLangPref, getLangPref);
