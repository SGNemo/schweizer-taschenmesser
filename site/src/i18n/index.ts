import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import { pt } from './pt';

export const LOCALES = ['de', 'en', 'es', 'fr', 'pt-BR'] as const;
export type Locale = (typeof LOCALES)[number];
export type Strings = typeof de | typeof en | typeof es | typeof fr | typeof pt;

export const strings: Record<Locale, Strings> = { de, en, es, fr, 'pt-BR': pt };

/**
 * Route table: the same page per language (German without prefix, the others under /en, /es, /fr,
 * /pt-br). The legal pages exist in German and English only; the other languages point to the
 * English ones (their footer link says "in English").
 */
export const routes = {
  home: { de: '/', en: '/en', es: '/es', fr: '/fr', 'pt-BR': '/pt-br' },
  imprint: { de: '/impressum', en: '/en/imprint', es: '/en/imprint', fr: '/en/imprint', 'pt-BR': '/en/imprint' },
  privacy: { de: '/datenschutz', en: '/en/privacy', es: '/en/privacy', fr: '/en/privacy', 'pt-BR': '/en/privacy' },
} as const;
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
