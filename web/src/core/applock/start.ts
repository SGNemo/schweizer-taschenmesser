/**
 * Arms the app lock while it is on and the app is unlocked: after `idleMinutes` without input and
 * when the app goes to the background (`now`, after a 30 s grace, or `never`). Same pattern as the
 * vault's auto-lock (`modules/accounts/autolock.ts`), but for the whole app. Timers and the platform
 * are injectable so tests run with fake time.
 */
import { getPlatform } from '@/core/platform';
import { now } from '@/core/time/now';
import { hasPin } from './pin';
import { disableBiometric } from './biometric';
import { readPrefs, subscribePrefs, writePrefs } from './prefs';
import { lockApp, unlockApp, useAppLock } from './state';

const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
export const BACKGROUND_GRACE_MS = 30_000;

export interface AppLockDeps {
  onBackground(cb: () => void): () => void;
  hasPin(): Promise<boolean>;
}

const defaultDeps = (): AppLockDeps => ({
  onBackground: (cb) => getPlatform().lifecycle.onBackground(cb),
  hasPin,
});

/**
 * A lock that is on without a PIN verifier (broken prefs read as "on", or the secret store was
 * emptied) cannot be opened: it is turned off. When the store cannot be read, the lock stays.
 */
async function reconcile(deps: AppLockDeps): Promise<void> {
  if (!readPrefs().enabled) return;
  const has = await deps.hasPin().catch(() => true);
  if (has || !readPrefs().enabled) return;
  writePrefs({ enabled: false });
  await disableBiometric();
  unlockApp();
}

/** Call once at startup; returns the stop function. */
export function startAppLock(deps: AppLockDeps = defaultDeps()): () => void {
  let disarm: (() => void) | undefined;

  const arm = () => {
    disarm?.();
    const prefs = readPrefs();
    if (!prefs.enabled || useAppLock.getState().locked) return;
    const idleMs = Number(prefs.idleMinutes) * 60_000;
    let idle: ReturnType<typeof setTimeout> | undefined;
    let grace: ReturnType<typeof setTimeout> | undefined;
    let lastActivity = now();
    const restart = () => {
      clearTimeout(idle);
      lastActivity = now();
      idle = setTimeout(lockApp, idleMs);
    };
    restart();
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, restart, { passive: true });
    const stopBackground = deps.onBackground(() => {
      if (prefs.background === 'now') lockApp();
      else if (prefs.background === '30s') {
        clearTimeout(grace);
        grace = setTimeout(lockApp, BACKGROUND_GRACE_MS);
      }
    });
    // Coming back inside the grace period cancels the pending lock; a timer the OS held back while
    // hidden is caught up here (the idle time counts from the last input, not from the timer).
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      clearTimeout(grace);
      if (now() - lastActivity >= idleMs) lockApp();
    };
    document.addEventListener('visibilitychange', onVisible);
    disarm = () => {
      clearTimeout(idle);
      clearTimeout(grace);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, restart);
      document.removeEventListener('visibilitychange', onVisible);
      stopBackground();
      disarm = undefined;
    };
  };

  let lastLocked = useAppLock.getState().locked;
  const unsubState = useAppLock.subscribe((s) => {
    if (s.locked === lastLocked) return;
    lastLocked = s.locked;
    arm();
  });
  const unsubPrefs = subscribePrefs(arm);
  arm();
  void reconcile(deps);
  return () => {
    unsubState();
    unsubPrefs();
    disarm?.();
  };
}
