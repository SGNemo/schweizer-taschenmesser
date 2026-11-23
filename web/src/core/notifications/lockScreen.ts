/**
 * NS6 (launch review 2026-11): what an Android notification shows on the lock screen (Android 8+,
 * which has channels). Off by default: notices go through channels whose lock-screen setting is
 * "secret" – a locked phone shows nothing of them; they are in the shade after unlocking. On: the
 * plugin's default channel (or the older quiet one), so Android's own lock-screen setting decides.
 * The channel decides because a notice's own visibility never reaches Android (the plugin's Rust
 * layer drops it); see `channelFor` in `core/platform/tauri`. The switch belongs to this phone
 * (localStorage, never synced): one device may lie on a desk at home, another in an office.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'tm-lock-screen-content';
const EVENT = 'tm-lock-screen-content-changed';

/** The lock-screen setting of the channel a notice goes through: -1 = secret (hidden), 0 = private. */
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
