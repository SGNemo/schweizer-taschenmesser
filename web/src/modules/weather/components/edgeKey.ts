import type { KeyboardEvent } from 'react';

/**
 * Home / End in a radio group (CONCEPT-DAYS §3): the first / last item is chosen and its radio focused; the arrow keys
 * stay native. Returns the item to choose, or `undefined` for any other key.
 */
export function edgeKey<T>(e: KeyboardEvent<HTMLElement>, items: readonly T[]): T | undefined {
  if (e.key !== 'Home' && e.key !== 'End') return undefined;
  const radios = e.currentTarget.querySelectorAll<HTMLInputElement>('input[type="radio"]');
  const i = e.key === 'Home' ? 0 : items.length - 1;
  const item = items[i];
  if (item === undefined) return undefined;
  e.preventDefault();
  radios[i]?.focus();
  return item;
}
