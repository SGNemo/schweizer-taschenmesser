/**
 * Widens string literals so a translation may differ in wording but not in shape: strings stay
 * strings, functions keep their parameters, nested objects and string arrays keep their keys.
 */
export type Shape<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : T extends (...args: infer A) => string
      ? (...args: A) => string
      : { [K in keyof T]: Shape<T[K]> };
