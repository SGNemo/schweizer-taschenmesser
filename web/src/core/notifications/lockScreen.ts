/**
 * NS6 (launch review 2026-11): what an Android notification shows on the lock screen. Off by
 * default: the notice is "private", so a locked phone shows that there is a reminder, not its title
 * or text. The switch belongs to this phone (localStorage, never synced): one device may lie on a
 * desk at home, another in an office.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'tm-lock-screen-content';
const EVENT = 'tm-lock-screen-content-changed';

/** Android's `NotificationCompat` visibility: 0 = private (content hidden when locked), 1 = public. */
export type LockScreenVisibility = 0 | 1;

export function lockScreenContent(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setLockScreenContent(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // storage blocked: the default (hidden) stays
  }
  window.dispatchEvent(new Event(EVENT));
}

export const lockScreenVisibility = (): LockScreenVisibility => (lockScreenContent() ? 1 : 0);

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function useLockScreenContent(): boolean {
  return useSyncExternalStore(subscribe, lockScreenContent, () => false);
}
