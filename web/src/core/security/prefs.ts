/**
 * Device-local security preferences (localStorage `tm-security`): screen guard and the backup
 * policy. Never synced, never exported, never part of profiles or the change history (the allow-list
 * in `core/settings/values.ts` cannot hold them; a test pins it). A broken or foreign value falls
 * back to the safe default of each key, never to a weaker one.
 */
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

export const STORAGE_KEY = 'tm-security';

export const SCREEN_GUARDS = ['vault', 'everywhere'] as const;
export type ScreenGuard = (typeof SCREEN_GUARDS)[number];

const schema = z.object({
  /** Android: where screenshots and the app-switcher preview are blocked (FLAG_SECURE). */
  screenGuard: z.enum(SCREEN_GUARDS).catch('vault'),
  /** Backups leave this device only encrypted: the plain export is not offered. */
  encryptedOnly: z.boolean().catch(false),
});
export type SecurityPrefs = z.output<typeof schema>;

export const DEFAULT_SECURITY_PREFS: SecurityPrefs = { screenGuard: 'vault', encryptedOnly: false };

function read(): SecurityPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SECURITY_PREFS;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_SECURITY_PREFS;
  } catch {
    return DEFAULT_SECURITY_PREFS;
  }
}

let current: SecurityPrefs | undefined;
const listeners = new Set<() => void>();

export function getSecurityPrefs(): SecurityPrefs {
  current ??= read();
  return current;
}

export function setSecurityPrefs(patch: Partial<SecurityPrefs>): void {
  const next = schema.parse({ ...getSecurityPrefs(), ...patch });
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the value still holds for this session.
  }
  for (const l of listeners) l();
}

export function subscribeSecurityPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live prefs for a component. */
export function useSecurityPrefs(): SecurityPrefs {
  return useSyncExternalStore(subscribeSecurityPrefs, getSecurityPrefs, getSecurityPrefs);
}

/** Tests only: forget the cached value (localStorage is read again). */
export function resetSecurityPrefsCache(): void {
  current = undefined;
}
