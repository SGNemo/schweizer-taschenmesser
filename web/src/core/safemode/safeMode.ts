import { getPlatform } from '@/core/platform';

/**
 * Safe mode: the app starts with every module switched off, so a module that crashes at start can
 * be reached and fixed. Nothing is changed on disk; the next normal start brings everything back.
 *
 * Asked by: desktop `--safe-mode` / `NEMO_SAFE_MODE=1` (Rust, `desktop_safe_mode`), the one-shot
 * switch set by a triple tap on the logo in the error screen (Android, browser), or `?safe=1`.
 */
const ONCE_KEY = 'tm-safe-mode-once';

let active = false;
let forced = false;

export const isSafeMode = (): boolean => active;
/** True when the launch itself asked (desktop flag): a reload would not leave safe mode. */
export const isSafeModeForced = (): boolean => forced;

function takeOnce(): boolean {
  try {
    const on = localStorage.getItem(ONCE_KEY) === '1';
    if (on) localStorage.removeItem(ONCE_KEY); // one start only
    return on;
  } catch {
    return false;
  }
}

/** Decides once at start, before anything reads the module states. */
export async function initSafeMode(search: string = location.search): Promise<boolean> {
  forced = await (getPlatform().desktop.safeMode?.() ?? Promise.resolve(false)).catch(() => false);
  const once = takeOnce();
  const url = new URLSearchParams(search).get('safe') === '1';
  active = forced || once || url;
  return active;
}

/** Arms safe mode for the next start only and restarts. */
export function requestSafeModeOnce(reload: () => void = () => location.reload()): void {
  try {
    localStorage.setItem(ONCE_KEY, '1');
  } catch {
    // blocked storage: safe mode is not available here
  }
  reload();
}

/** Test hook. */
export function setSafeModeForTests(on: boolean, isForced = false): void {
  active = on;
  forced = isForced;
}

/** Three clicks within `windowMs`: calls `onTriple`. */
export function createTripleTap(onTriple: () => void, windowMs = 900, now = () => Date.now()) {
  let taps: number[] = [];
  return () => {
    const t = now();
    taps = [...taps.filter((x) => t - x <= windowMs), t];
    if (taps.length >= 3) {
      taps = [];
      onTriple();
    }
  };
}
