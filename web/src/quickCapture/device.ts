import { useSyncExternalStore } from 'react';

/**
 * Per-device switches for the desktop shell (hotkey, tray, autostart, clipboard). They stay in
 * `localStorage`, not in the synced settings: another computer may not want the same hotkey. The
 * capture window shares the origin, so both windows read the same values.
 */
export interface DevicePrefs {
  /** Accelerator string, e.g. `Ctrl+Shift+Space`; empty = no global hotkey. */
  hotkey: string;
  closeToTray: boolean;
  autostart: boolean;
  /** Pre-fill the capture window from the clipboard. Off unless the user turns it on. */
  clipboard: boolean;
}

export const DEFAULT_HOTKEY = 'Ctrl+Shift+Space';
export const DEFAULT_PREFS: DevicePrefs = {
  hotkey: DEFAULT_HOTKEY,
  closeToTray: false,
  autostart: false,
  clipboard: false,
};

const KEY = 'tm-quick-capture';

export function readPrefs(): DevicePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_PREFS;
    const v = JSON.parse(raw) as Partial<DevicePrefs>;
    return {
      hotkey: typeof v.hotkey === 'string' ? v.hotkey : DEFAULT_PREFS.hotkey,
      closeToTray: v.closeToTray === true,
      autostart: v.autostart === true,
      clipboard: v.clipboard === true,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

let snapshot = readPrefs();
const listeners = new Set<() => void>();

const refresh = () => {
  snapshot = readPrefs();
  listeners.forEach((l) => l());
};

export function writePrefs(patch: Partial<DevicePrefs>): DevicePrefs {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage may be blocked; the value then only lives until reload.
  }
  snapshot = next;
  listeners.forEach((l) => l());
  return next;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  window.addEventListener('storage', refresh);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', refresh);
  };
};

export const useDevicePrefs = (): DevicePrefs => useSyncExternalStore(subscribe, () => snapshot);
