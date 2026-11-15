/**
 * Device-local app lock preferences (localStorage `tm-app-lock`). Never synced, never in profiles,
 * settings history or export (`core/settings/values.ts` must not know them; pinned by a test).
 *
 * Every key falls back to its safe value on its own: a broken stored value keeps the lock **on**
 * (`startAppLock` turns it off again only when no PIN verifier exists, so nobody is locked out of an
 * app that has no PIN). A missing value (never switched on) is the plain default: off.
 */
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

export const APP_LOCK_KEY = 'tm-app-lock';
export const IDLE_MINUTES = ['1', '5', '15', '30'] as const;
export const BACKGROUND_MODES = ['now', '30s', 'never'] as const;
export type IdleMinutes = (typeof IDLE_MINUTES)[number];
export type BackgroundMode = (typeof BACKGROUND_MODES)[number];

const schema = z.object({
  enabled: z.boolean().catch(true),
  idleMinutes: z.enum(IDLE_MINUTES).catch('5'),
  background: z.enum(BACKGROUND_MODES).catch('now'),
  biometric: z.boolean().catch(false),
});

export type AppLockPrefs = z.infer<typeof schema>;

// Leaving the app locks after 30 s by default: a trip to the file picker or the camera comes back to the
// same page (the lock unmounts it). A broken stored value still falls back to "now", the safe side.
export const DEFAULT_PREFS: AppLockPrefs = {
  enabled: false,
  idleMinutes: '5',
  background: '30s',
  biometric: false,
};

/** Pure parse of the stored text: `null` = never set (defaults), anything unreadable = safe values. */
export function parsePrefs(raw: string | null): AppLockPrefs {
  if (raw === null) return { ...DEFAULT_PREFS };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    value = {};
  }
  const obj = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return schema.parse(obj);
}

function readRaw(): string | null {
  try {
    return localStorage.getItem(APP_LOCK_KEY);
  } catch {
    return null; // storage blocked: nothing was ever stored either
  }
}

let snapshot: AppLockPrefs | undefined;
const listeners = new Set<() => void>();

export function readPrefs(): AppLockPrefs {
  snapshot ??= parsePrefs(readRaw());
  return snapshot;
}

export function writePrefs(patch: Partial<AppLockPrefs>): void {
  const next = { ...readPrefs(), ...patch };
  snapshot = next;
  try {
    localStorage.setItem(APP_LOCK_KEY, JSON.stringify(next));
  } catch {
    // storage blocked: the choice holds for this session only
  }
  for (const l of listeners) l();
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Drops the cached snapshot (another tab wrote, or a test changed localStorage). */
export function reloadPrefs(): void {
  snapshot = undefined;
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === APP_LOCK_KEY || e.key === null) reloadPrefs();
  });
}

export function useAppLockPrefs(): AppLockPrefs {
  return useSyncExternalStore(subscribePrefs, readPrefs, readPrefs);
}
