import { getPlatform } from '@/core/platform';
import { startAutoLock } from './autolock';
import { getBridge, resumeBridge, stopBridge } from './bridge/control';
import { isUnlocked, useSession } from './session';
import { lockVault } from './vault';

let findRequests = 0;

/**
 * The vault search key (desktop): jump to the vault search, but only while the vault is unlocked –
 * a locked vault just gets the window brought forward and stays on its lock screen.
 */
export function openVaultSearch(): void {
  if (!isUnlocked()) return;
  history.pushState(null, '', `/accounts?find=${++findRequests}`);
  window.dispatchEvent(new PopStateEvent('popstate')); // lets the router pick the new URL up
}

/** Module service (see `contributions.services`): auto-lock runs while the module is enabled. */
export default function startAccountsService(): () => void {
  const stop = startAutoLock();
  const stopSearchKey = getPlatform().desktop.onVaultSearch(openVaultSearch);
  // A lock ends the extension bridge sessions (desktop, off unless the user switched it on) and
  // wipes a copied secret that is still on the clipboard.
  const stopLockWatch = useSession.subscribe((s) => {
    if (s.session.status !== 'locked') return;
    getBridge().endSessions();
    void getPlatform()
      .clipboard.clearSensitive()
      .catch(() => undefined);
  });
  void resumeBridge();
  return () => {
    stopLockWatch();
    void stopBridge();
    stopSearchKey();
    stop();
    lockVault(); // disabling the module must not leave an open vault behind
  };
}
