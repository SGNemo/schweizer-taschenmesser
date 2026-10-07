import { de } from './de';
import { en } from './en';

export type Locale = 'de' | 'en';
export type Strings = typeof de | typeof en;

export const strings: Record<Locale, Strings> = { de, en };

/** Route table: the same page in both languages (German without prefix, English under /en). */
export const routes = {
  home: { de: '/', en: '/en' },
  imprint: { de: '/impressum', en: '/en/imprint' },
  privacy: { de: '/datenschutz', en: '/en/privacy' },
} as const;
export type RouteKey = keyof typeof routes;

export function t(locale: Locale): Strings {
  return strings[locale];
}
