import * as base from 'react/jsx-runtime';
import { wrapProps } from './wrap';

export type { JSX } from 'react/jsx-runtime';
export const Fragment = base.Fragment;

/** Same as React's runtime, but string children of ordinary elements become `ReadableText` (reading aid). */
export function jsx(type: unknown, props: Record<string, unknown>, key?: string) {
  return base.jsx(type as never, wrapProps(type, props), key);
}
export function jsxs(type: unknown, props: Record<string, unknown>, key?: string) {
  return base.jsxs(type as never, wrapProps(type, props), key);
}
