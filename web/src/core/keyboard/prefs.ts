import { useSyncExternalStore } from 'react';
import { DEFAULT_SHORTCUT_PREFS, sanitizePrefs, type ShortcutPrefs } from './map';

/**
 * Per-device key map (`localStorage` `tm-shortcuts`, not synced: another device has another
 * keyboard). Holds only what differs from the defaults, so a later change of a default reaches
 * everyone who never touched the key.
 */
const KEY = 'tm-shortcuts';

export function readShortcutPrefs(): ShortcutPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : DEFAULT_SHORTCUT_PREFS;
  } catch {
    return DEFAULT_SHORTCUT_PREFS;
  }
}

let snapshot = readShortcutPrefs();
const listeners = new Set<() => void>();

export function writeShortcutPrefs(next: ShortcutPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked; the map then only lives until reload.
  }
  snapshot = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== null && e.key !== KEY) return;
    snapshot = readShortcutPrefs();
    l();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
};

export const useShortcutPrefs = (): ShortcutPrefs =>
  useSyncExternalStore(subscribe, () => snapshot);
export const currentShortcutPrefs = (): ShortcutPrefs => snapshot;
