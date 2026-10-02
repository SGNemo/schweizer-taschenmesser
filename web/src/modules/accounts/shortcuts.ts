/** Single-key shortcuts of the entry detail view (not active while typing in a field). */
export type EntryAction = 'username' | 'password' | 'totp' | 'open';

const KEYS: Record<string, EntryAction> = { u: 'username', p: 'password', t: 'totp', o: 'open' };

export function entryAction(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  return KEYS[e.key.toLowerCase()];
}

/** True for fields where a letter key is text, not a shortcut. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}
