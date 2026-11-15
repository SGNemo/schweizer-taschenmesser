/**
 * Whether the app is locked right now. The first value is read synchronously from the device-local
 * prefs when this module loads, so an app with the lock on is locked before the first render.
 */
import { create } from 'zustand';
import { readPrefs } from './prefs';

interface AppLockState {
  locked: boolean;
}

export const useAppLock = create<AppLockState>(() => ({ locked: readPrefs().enabled }));

export const isAppLocked = (): boolean => useAppLock.getState().locked;

export function lockApp(): void {
  if (readPrefs().enabled) useAppLock.setState({ locked: true });
}

export function unlockApp(): void {
  useAppLock.setState({ locked: false });
}
