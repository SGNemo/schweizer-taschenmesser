/** Single-key shortcuts of the entry detail view (not active while typing in a field). */
export type EntryAction = 'username' | 'password' | 'totp' | 'open';

const KEYS: Record<string, EntryAction> = { u: 'username', p: 'password', t: 'totp', o: 'open' };

export function entryAction(e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return undefined;
  return KEYS[e.key.toLowerCase()];
}
