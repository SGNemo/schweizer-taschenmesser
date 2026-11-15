/**
 * Whether the app is locked right now. The first value is read synchronously from the device-local
 * prefs when this module loads, so an app with the lock on is locked before the first render.
 * A lock is sent to the other windows of this app (tabs, detached tool windows) and to the event
 * bus (`app.locked`: the vault locks too). An unlock is never sent: every window asks for the PIN.
 */
import { create } from 'zustand';
import { bus } from '@/core/events';
import { readPrefs } from './prefs';

interface AppLockState {
  locked: boolean;
}

export const useAppLock = create<AppLockState>(() => ({ locked: readPrefs().enabled }));

const CHANNEL = 'nemo-app-lock';
let channel: BroadcastChannel | undefined;
function lockChannel(): BroadcastChannel | undefined {
  if (!channel && typeof BroadcastChannel !== 'undefined') channel = new BroadcastChannel(CHANNEL);
  return channel;
}

/** Locks this window (when the lock is on); `fromOtherWindow` = a lock another window sent. */
export function lockApp(fromOtherWindow = false): void {
  if (!readPrefs().enabled) return;
  useAppLock.setState({ locked: true });
  void bus.emit('app.locked', {});
  if (!fromOtherWindow) lockChannel()?.postMessage('lock');
}

/** Calls back when another window of this app locked. */
export function onOtherWindowLock(callback: () => void): () => void {
  const ch = lockChannel();
  if (!ch) return () => undefined;
  const listener = (e: MessageEvent) => {
    if (e.data === 'lock') callback();
  };
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

export function unlockApp(): void {
  useAppLock.setState({ locked: false });
}
