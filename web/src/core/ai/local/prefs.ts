import { useSyncExternalStore } from 'react';

/**
 * Per-device choices for the built-in local model. They stay in `localStorage`, not in the synced
 * settings: another computer has other hardware and other downloaded models.
 */
export interface LocalPrefs {
  /** File of the model to use (`catalogue.json`), empty = none chosen. */
  file: string;
  /** Run on the GPU when the build and the driver offer one. */
  gpu: boolean;
  /** Stage 1 of the AI entry pipeline: ask the local model before the cloud. */
  first: boolean;
  /** Load the model when it is first needed (it takes seconds and RAM, so not at app start). */
  autoLoad: boolean;
}

export const DEFAULT_LOCAL_PREFS: LocalPrefs = { file: '', gpu: true, first: true, autoLoad: true };

const KEY = 'tm-local-model';

export function readLocalPrefs(): LocalPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_LOCAL_PREFS;
    const v = JSON.parse(raw) as Partial<LocalPrefs>;
    return {
      file: typeof v.file === 'string' ? v.file : DEFAULT_LOCAL_PREFS.file,
      gpu: v.gpu !== false,
      first: v.first !== false,
      autoLoad: v.autoLoad !== false,
    };
  } catch {
    return DEFAULT_LOCAL_PREFS;
  }
}

let snapshot = readLocalPrefs();
const listeners = new Set<() => void>();

export function writeLocalPrefs(patch: Partial<LocalPrefs>): LocalPrefs {
  const next = { ...readLocalPrefs(), ...patch };
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
  return () => listeners.delete(l);
};

export const getLocalPrefs = (): LocalPrefs => snapshot;

export const useLocalPrefs = (): LocalPrefs => useSyncExternalStore(subscribe, getLocalPrefs);
