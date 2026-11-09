/**
 * "Uhrzeit neben dem Logo" (Settings → Darstellung), device-local in `tm-clock`. Default on in the desktop app
 * (the window often covers the taskbar), off on Android and in the PWA (the status bar shows the time). Only a
 * choice that differs from the default is stored.
 */
import { useSyncExternalStore } from 'react';
import { getPlatform } from '@/core/platform';
import type { PlatformKind } from '@/core/platform/types';

export const CLOCK_KEY = 'tm-clock';

export const clockDefault = (kind: PlatformKind): boolean => kind === 'desktop';

const listeners = new Set<() => void>();

export function readClockOn(kind: PlatformKind = getPlatform().kind): boolean {
  try {
    const v = localStorage.getItem(CLOCK_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
  } catch {
    // Storage blocked: the default applies.
  }
  return clockDefault(kind);
}

export function setClockOn(on: boolean, kind: PlatformKind = getPlatform().kind): void {
  try {
    if (on === clockDefault(kind)) localStorage.removeItem(CLOCK_KEY);
    else localStorage.setItem(CLOCK_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: nothing to remember.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Whether the clock next to the logo is shown on this device. */
export function useClockOn(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readClockOn(),
    () => readClockOn(),
  );
}
