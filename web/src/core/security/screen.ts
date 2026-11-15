/**
 * Screen guard (Android FLAG_SECURE: no screenshots, no app-switcher preview; a no-op elsewhere).
 * Pages that always need it (the vault) hold it while mounted; the setting "Bildschirmschutz:
 * überall" holds it for the whole app. The flag is off only when nobody holds it, so leaving the
 * vault never switches off the app-wide guard.
 */
import { getPlatform } from '@/core/platform';
import { getSecurityPrefs, subscribeSecurityPrefs } from './prefs';

let holds = 0;
let applied: boolean | undefined;

function apply(): void {
  const on = holds > 0 || getSecurityPrefs().screenGuard === 'everywhere';
  if (on === applied) return;
  applied = on;
  void getPlatform().screen.setSecure(on);
}

/** Keeps the guard on until the returned function is called (once). */
export function holdScreenGuard(): () => void {
  holds += 1;
  apply();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
    apply();
  };
}

/** Applies the setting now and on every change. Call once at startup. */
export function startScreenGuard(): () => void {
  apply();
  return subscribeSecurityPrefs(apply);
}

/** Tests only. */
export function resetScreenGuard(): void {
  holds = 0;
  applied = undefined;
}
