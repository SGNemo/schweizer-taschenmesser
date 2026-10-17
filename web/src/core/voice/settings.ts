import { useSyncExternalStore } from 'react';

/**
 * Per-device voice input switches (`localStorage`, not synced: another device may have no
 * microphone or a different engine). Off by default: recognition can send audio to the browser
 * vendor, so the person has to turn it on, once with an explanatory notice.
 */
export interface VoicePrefs {
  enabled: boolean;
  /** In-app key, e.g. `F4` or `Alt+M`. Empty = no key (the button still works). */
  key: string;
  /** Desktop only: system-wide key (accelerator, e.g. `Ctrl+Alt+M`); empty = off. */
  globalHotkey: string;
  /** The privacy notice was shown and accepted once. */
  noticeSeen: boolean;
}

export const DEFAULT_VOICE_KEY = 'F4';
export const DEFAULT_VOICE_PREFS: VoicePrefs = {
  enabled: false,
  key: DEFAULT_VOICE_KEY,
  globalHotkey: '',
  noticeSeen: false,
};

const KEY = 'tm-voice';

export function readVoicePrefs(): VoicePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_VOICE_PREFS;
    const v = JSON.parse(raw) as Partial<VoicePrefs>;
    return {
      enabled: v.enabled === true,
      key: typeof v.key === 'string' ? v.key : DEFAULT_VOICE_PREFS.key,
      globalHotkey: typeof v.globalHotkey === 'string' ? v.globalHotkey : '',
      noticeSeen: v.noticeSeen === true,
    };
  } catch {
    return DEFAULT_VOICE_PREFS;
  }
}

let snapshot = readVoicePrefs();
const listeners = new Set<() => void>();

export function writeVoicePrefs(patch: Partial<VoicePrefs>): VoicePrefs {
  const next = { ...readVoicePrefs(), ...patch };
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
  const onStorage = () => {
    snapshot = readVoicePrefs();
    l();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
};

export const useVoicePrefs = (): VoicePrefs => useSyncExternalStore(subscribe, () => snapshot);
export const currentVoicePrefs = (): VoicePrefs => snapshot;
