import { useSyncExternalStore } from 'react';

/**
 * UI language of this device. The choice stays in `localStorage` (like the other per-device
 * choices), not in the synced settings. "System" follows the device language; anything the app
 * does not speak falls back to English. German is the source language of every text.
 *
 * `ACTIVE_LOCALES` is the single source of the languages the app offers (picker, setup, system
 * detection, catalogs, seed data, tests). Spanish, French and Brazilian Portuguese are frozen: their
 * texts stay in the repo (`FROZEN_LOCALES`, docs/i18n/FROZEN.md) but are neither shipped nor kept up
 * to date. Re-activating one = moving it from `FROZEN_LOCALES` to `ACTIVE_LOCALES` (see FROZEN.md).
 */
export const ACTIVE_LOCALES = ['de', 'en'] as const;
export const FROZEN_LOCALES = ['es', 'fr', 'pt-BR'] as const;
/** A language the app offers. */
export type Lang = (typeof ACTIVE_LOCALES)[number];
/** A language whose texts are kept in the repo but not shipped. */
export type FrozenLang = (typeof FROZEN_LOCALES)[number];
/** Every language with texts in the repo (active or frozen); for typing kept translations only. */
export type KnownLang = Lang | FrozenLang;
/** Same list as `ACTIVE_LOCALES` (older name, kept so iterating code reads naturally). */
export const LANGS: readonly Lang[] = ACTIVE_LOCALES;
/** What the person picked: a language or "follow the device". */
export type LangPref = Lang | 'system';
export const SOURCE_LANG: Lang = 'de';
/** Names of the languages in their own language (never translated). */
export const LANG_NAMES: Record<Lang, string> = {
  de: 'Deutsch',
  en: 'English',
};
export const FALLBACK_LANG: Lang = 'en';

const KEY = 'tm-lang';

export const isLang = (v: unknown): v is Lang => ACTIVE_LOCALES.includes(v as Lang);
export const isFrozenLang = (v: unknown): v is FrozenLang =>
  FROZEN_LOCALES.includes(v as FrozenLang);
export const isLangPref = (v: unknown): v is LangPref => v === 'system' || isLang(v);

/** Best supported language for a list of BCP 47 tags (`navigator.languages`), English otherwise. */
export function matchLang(tags: readonly string[]): Lang {
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    const exact = LANGS.find((l) => l.toLowerCase() === lower);
    if (exact) return exact;
    const base = lower.split('-')[0];
    // Any German or English is served the one we have; every other language gets English.
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

/**
 * A stored value as a preference: a frozen language (picked before es/fr/pt-BR were frozen) quietly
 * becomes English, anything unknown "system".
 */
export const toLangPref = (v: unknown): LangPref =>
  isLangPref(v) ? v : isFrozenLang(v) ? FALLBACK_LANG : 'system';

/**
 * Stored preference; nothing stored means "system". A frozen language is migrated to English once
 * and written back, without a dialog (the release notes say so).
 */
export function readLangPref(): LangPref {
  try {
    const v = localStorage.getItem(KEY);
    const next = toLangPref(v);
    if (isFrozenLang(v)) localStorage.setItem(KEY, next);
    return next;
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
  // Re-read at start: migrates a frozen choice (es, fr, pt-BR) to English before anything loads.
  if (hasStoredLangPref()) pref = readLangPref();
  else {
    // Decided once: later starts must not mistake the new installation's own data for an old one.
    pref = (await hasExistingData().catch(() => false)) ? 'de' : 'system';
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      // see setLangPref
    }
  }
  const lang = resolveLang(pref);
  try {
    await prepare(lang);
    apply(lang);
  } catch {
    // Texts that cannot load (offline after an update, a missing chunk) must never block the start:
    // German is built in. The stored choice stays and applies on the next start.
    apply(SOURCE_LANG);
  }
}

/**
 * Another tab of the app switched the language: `storage` fires in every other tab of this origin,
 * so this one follows without a reload (X38). The stored value is already the new one.
 */
async function followOtherTab(e: StorageEvent): Promise<void> {
  if (e.key !== KEY) return;
  const next = toLangPref(e.newValue);
  const lang = resolveLang(next);
  if (next === pref && lang === current) return;
  pref = next;
  try {
    await prepare(lang);
    apply(lang);
  } catch {
    // The texts cannot load right now: this tab keeps its language until the next start.
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function')
  window.addEventListener('storage', (e) => void followOtherTab(e));

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

/** Runs after every language switch (for things outside React, e.g. native tray labels). */
export const onLangChange = (listener: () => void): (() => void) => subscribe(listener);

/** Current language; re-renders on a switch. */
export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);
/** Current preference ("system" or a language); re-renders on a switch. */
export const useLangPref = (): LangPref =>
  useSyncExternalStore(subscribe, getLangPref, getLangPref);
