/**
 * Locks the vault after inactivity and when the app goes to the background. Timers are injectable
 * so the behaviour can be tested with fake time.
 */
import { getPlatform } from '@/core/platform';
import { getSettings } from '@/core/settings/settings';
import { defaultSettings, settingsSchema, type AccountsSettings } from './settings';
import { isUnlocked, useSession } from './session';
import { lockVault } from './vault';

const SCOPE = 'module.accounts';
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
const BACKGROUND_GRACE_MS = 30_000;

export const loadAccountsSettings = (): Promise<AccountsSettings> =>
  getSettings(SCOPE, settingsSchema, defaultSettings);

export interface AutoLockDeps {
  settings(): Promise<AccountsSettings>;
  onBackground(cb: () => void): () => void;
  lock(): void;
}

const defaultDeps = (): AutoLockDeps => ({
  settings: loadAccountsSettings,
  onBackground: (cb) => getPlatform().lifecycle.onBackground(cb),
  lock: lockVault,
});

/**
 * Arms the locks while the vault is unlocked; disarms them when it locks. Call once at startup –
 * it reacts to the session store.
 */
export function startAutoLock(deps: AutoLockDeps = defaultDeps()): () => void {
  let disarm: (() => void) | undefined;

  const arm = async () => {
    const { autoLockMinutes, backgroundLock } = await deps.settings();
    if (!isUnlocked() || disarm) return; // locked again meanwhile / already armed
    let idle: ReturnType<typeof setTimeout> | undefined;
    let grace: ReturnType<typeof setTimeout> | undefined;
    const restart = () => {
      clearTimeout(idle);
      idle = setTimeout(deps.lock, Number(autoLockMinutes) * 60_000);
    };
    restart();
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, restart, { passive: true });
    const stopBackground = deps.onBackground(() => {
      if (backgroundLock === 'now') deps.lock();
      else {
        clearTimeout(grace);
        grace = setTimeout(deps.lock, BACKGROUND_GRACE_MS);
      }
    });
    // Coming back inside the grace period cancels the pending background lock.
    const onVisible = () => {
      if (document.visibilityState === 'visible') clearTimeout(grace);
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

  const unsubscribe = useSession.subscribe((state) => {
    if (state.session.status === 'unlocked') void arm();
    else disarm?.();
  });
  if (isUnlocked()) void arm();
  return () => {
    unsubscribe();
    disarm?.();
  };
}
