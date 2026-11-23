/**
 * NS6 (launch review 2026-11): what an Android notification shows on the lock screen. Off by
 * default: the notice is "secret" – a locked phone shows nothing of it (it still sounds; it is there
 * after unlocking). "Private" would not be enough: Android only hides a private notice's text when
 * the user chose "hide sensitive content", and its default shows everything. On: "private", so
 * Android's own lock-screen setting decides. The switch belongs to this phone (localStorage, never
 * synced): one device may lie on a desk at home, another in an office.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'tm-lock-screen-content';
const EVENT = 'tm-lock-screen-content-changed';

/** Android's `NotificationCompat` visibility: -1 = secret (not on the lock screen), 0 = private. */
export type LockScreenVisibility = -1 | 0;

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

export const lockScreenVisibility = (): LockScreenVisibility => (lockScreenContent() ? 0 : -1);

/** Called when the switch changes on this device (the scheduled alarms are rebuilt with it). */
export function onLockScreenContentChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

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
