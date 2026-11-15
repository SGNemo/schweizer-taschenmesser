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
import { holdScreenGuard } from '@/core/security/screen';
import { lockApp, onOtherWindowLock, unlockApp, useAppLock } from './state';

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
  // When this window went to the background (30 s mode); kept across a re-arm (prefs changed elsewhere).
  let hiddenAt: number | undefined;

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
        hiddenAt = now();
        clearTimeout(grace);
        grace = setTimeout(lockApp, BACKGROUND_GRACE_MS);
      }
    });
    // Coming back inside the grace period cancels the pending lock. Timers the OS froze while hidden
    // (Android, background tabs) are caught up from the clock: away 30 s or longer locks, and the idle
    // time counts from the last input, not from the timer.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const away = hiddenAt === undefined ? 0 : now() - hiddenAt;
      hiddenAt = undefined;
      clearTimeout(grace);
      // A clock set back while away (negative) fails closed.
      if (away < 0 || away >= BACKGROUND_GRACE_MS || now() - lastActivity >= idleMs) lockApp();
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
  // While the lock is on: no screenshots and no app-switcher picture (Android; a no-op elsewhere), so the
  // last screen is not shown in the recent apps while Nemo is locked. A lock turned off in another window
  // opens this one (its PIN verifier is gone, no PIN could open it any more).
  let releaseGuard: (() => void) | undefined;
  const follow = () => {
    const on = readPrefs().enabled;
    if (on && !releaseGuard) releaseGuard = holdScreenGuard();
    if (!on) {
      releaseGuard?.();
      releaseGuard = undefined;
      if (useAppLock.getState().locked) unlockApp();
    }
    arm();
  };
  const unsubPrefs = subscribePrefs(follow);
  const unsubOthers = onOtherWindowLock(() => lockApp());
  follow();
  void reconcile(deps);
  return () => {
    unsubState();
    unsubPrefs();
    unsubOthers();
    releaseGuard?.();
    disarm?.();
  };
}
