import { startAutoLock } from './autolock';
import { lockVault } from './vault';

/** Module service (see `contributions.services`): auto-lock runs while the module is enabled. */
export default function startAccountsService(): () => void {
  const stop = startAutoLock();
  return () => {
    stop();
    lockVault(); // disabling the module must not leave an open vault behind
  };
}
