import * as base from 'react/jsx-dev-runtime';
import { wrapProps } from './wrap';

export type { JSX } from 'react/jsx-dev-runtime';
export const Fragment = base.Fragment;

export function jsxDEV(
  type: unknown,
  props: Record<string, unknown>,
  key: string | undefined,
  isStatic: boolean,
  source: unknown,
  self: unknown,
) {
  return base.jsxDEV(type as never, wrapProps(type, props), key, isStatic, source as never, self);
}
