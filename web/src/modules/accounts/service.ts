import { getPlatform } from '@/core/platform';
import { startAutoLock } from './autolock';
import { isUnlocked } from './session';
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
  return () => {
    stopSearchKey();
    stop();
    lockVault(); // disabling the module must not leave an open vault behind
  };
}
