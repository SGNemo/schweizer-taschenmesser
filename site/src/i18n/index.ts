import { de } from './de';
import { en } from './en';
import { routes } from '../routes.js';

/**
 * Languages the site offers: German and English, same as the app (`ACTIVE_LOCALES` in
 * web/src/core/i18n/lang.ts). Spanish, French and Brazilian Portuguese are frozen
 * (docs/i18n/FROZEN.md): their texts stay in es.ts, fr.ts, pt.ts but are not built; the old URLs
 * redirect to English (`redirects` in astro.config.mjs, public/_redirects).
 */
export const LOCALES = ['de', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export type Strings = typeof de | typeof en;

export const strings: Record<Locale, Strings> = { de, en };

export { routes };
export type RouteKey = keyof typeof routes;

/** Languages that have their own page for a route (the switch offers only those). */
export function localesFor(route: RouteKey): readonly Locale[] {
  const seen = new Set<string>();
  return LOCALES.filter((l) => {
    const path = routes[route][l];
    if (seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

/** `hreflang` / `<html lang>` value for a locale. */
export const hreflang = (l: Locale): string => l;

export function t(locale: Locale): Strings {
  return strings[locale];
}
