import { ENVELOPE_KEYS, type Stored } from './types';

/** The user data of a stored record without the sync envelope (id, timestamps, device, tombstone, field stamps): the base of a duplicate. */
export function copyData<T extends object>(record: Stored<T>): T {
  const skip = new Set<string>(ENVELOPE_KEYS);
  return Object.fromEntries(Object.entries(record).filter(([k]) => !skip.has(k))) as T;
}
