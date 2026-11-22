/**
 * The Downloads choices that open the network or pick where files land: torrent part on, DHT,
 * UPnP and the default folder. Device-local (security review 2026-11, DL10): another device, a
 * merged backup or the sync server cannot switch the peer listener on here or point downloads at
 * another folder. Kept in local storage under a `tm-` key, so "Alle Daten löschen" clears it.
 */
import { useSyncExternalStore } from 'react';
import { z } from 'zod';

const KEY = 'tm-downloads-device';

const schema = z.object({
  torrent: z.boolean().catch(false),
  dht: z.boolean().catch(true),
  upnp: z.boolean().catch(false),
  /** Last folder chosen in the native dialog here ('' = the system's Downloads folder). */
  folder: z.string().catch(''),
});

export type DevicePrefs = z.output<typeof schema>;

export const DEVICE_DEFAULTS: DevicePrefs = { torrent: false, dht: true, upnp: false, folder: '' };

const listeners = new Set<() => void>();
let cached: DevicePrefs | undefined;

function storage(): Storage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined; // storage blocked: defaults, nothing kept
  }
}

export function readDevicePrefs(): DevicePrefs {
  if (cached) return cached;
  let raw: unknown;
  try {
    raw = JSON.parse(storage()?.getItem(KEY) ?? '{}');
  } catch {
    raw = {};
  }
  const parsed = schema.safeParse(raw && typeof raw === 'object' ? raw : {});
  cached = parsed.success ? parsed.data : { ...DEVICE_DEFAULTS };
  return cached;
}

export function setDevicePrefs(patch: Partial<DevicePrefs>): void {
  cached = { ...readDevicePrefs(), ...patch };
  try {
    storage()?.setItem(KEY, JSON.stringify(cached));
  } catch {
    // full or blocked: the choice holds for this session
  }
  for (const l of listeners) l();
}

/** Tests: forget the cached value (a test changes local storage directly). */
export function resetDevicePrefsCache(): void {
  cached = undefined;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDevicePrefs(): [DevicePrefs, (patch: Partial<DevicePrefs>) => void] {
  const prefs = useSyncExternalStore(subscribe, readDevicePrefs, readDevicePrefs);
  return [prefs, setDevicePrefs];
}
