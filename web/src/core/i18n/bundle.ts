import { getLang, useLang, type Lang } from './lang';

/** Widens string literals so the English bundle may differ in wording but not in shape. */
type Shape<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : { [K in keyof T]: Shape<T[K]> };

/**
 * Text bundle with a German source and an English translation of the same shape (checked by the
 * compiler). `strings.ts` stays German-only; new feature texts live in their own bundle file.
 */
export function defineBundle<T extends object>(de: T, en: Shape<T>) {
  const map: Record<Lang, T> = { de, en: en as unknown as T };
  /** Current language, non-reactive (use in event handlers and plain functions). */
  const get = (): T => map[getLang()];
  /** Current language, re-renders when the language changes. */
  const use = (): T => map[useLang()];
  return { de, en: en as unknown as T, get, use };
}
