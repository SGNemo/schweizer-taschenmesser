import { getLang, useLang, type FrozenLang, type Lang } from './lang';
import type { Shape } from './shape';

export type { Shape } from './shape';

/**
 * Every active language except the German source, each with the source's shape: English is
 * required. Frozen languages (es, fr, pt-BR; docs/i18n/FROZEN.md) are optional and ignored at
 * runtime: texts already written stay, new bundles leave them out.
 */
export type Translations<T> = { en: Shape<T> } & {
  [L in Exclude<Lang, 'de' | 'en'>]: Shape<T>;
} & { [L in FrozenLang]?: Shape<T> };

/**
 * Small text bundle that lives next to a feature instead of in `strings.ts`: German source plus
 * the other languages, inline (no lazy loading, so keep bundles small). The compiler checks that
 * every language has the same shape.
 */
export function defineBundle<T extends object>(de: T, translations: Translations<T>) {
  const map = { de, ...translations } as unknown as Partial<Record<Lang, T>> & { de: T; en: T };
  // Frozen languages are never the current language (`getLang()` only returns active ones).
  /** Current language, non-reactive (use in event handlers and plain functions). */
  const get = (): T => map[getLang()] ?? map.en;
  /** Current language, re-renders when the language changes. */
  const use = (): T => map[useLang()] ?? map.en;
  return { ...map, get, use } as typeof map & { get: () => T; use: () => T };
}
