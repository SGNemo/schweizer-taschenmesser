import { useSyncExternalStore } from 'react';

/**
 * UI language of this device. Stays in `localStorage` (like the other per-device choices), not in
 * the synced settings. German is the default and the fallback; English exists for the texts that
 * are defined with `defineBundle` (see `bundle.ts`).
 */
export const LANGS = ['de', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'de';

const KEY = 'tm-lang';

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

export function readLang(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    return isLang(v) ? v : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

let current: Lang = readLang();
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // private mode: the choice then lasts for this session only
  }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useLang = (): Lang => useSyncExternalStore(subscribe, getLang, getLang);
