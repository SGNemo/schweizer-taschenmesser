import { getLang, useLang, type Lang } from './lang';
import type { Shape } from './shape';

export type { Shape } from './shape';

/**
 * Every language except the German source, each with the source's shape. English is required;
 * a language left out falls back to English. New feature texts give every language; leave one out
 * only for a reason stated at the bundle (legal texts stay German and English).
 */
export type Translations<T> = { en: Shape<T> } & {
  [L in Exclude<Lang, 'de' | 'en'>]?: Shape<T>;
};

/**
 * Small text bundle that lives next to a feature instead of in `strings.ts`: German source plus
 * the other languages, inline (no lazy loading, so keep bundles small). The compiler checks that
 * every language has the same shape.
 */
export function defineBundle<T extends object>(de: T, translations: Translations<T>) {
  const map = { de, ...translations } as unknown as Partial<Record<Lang, T>> & { de: T; en: T };
  /** Current language, non-reactive (use in event handlers and plain functions). */
  const get = (): T => map[getLang()] ?? map.en;
  /** Current language, re-renders when the language changes. */
  const use = (): T => map[useLang()] ?? map.en;
  return { ...map, get, use } as typeof map & { get: () => T; use: () => T };
}
