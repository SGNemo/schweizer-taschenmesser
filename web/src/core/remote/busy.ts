import { autoBackupRunning } from '@/core/backup/auto';
import { getPlatform } from '@/core/platform';
import { useSyncStatus } from '@/core/sync/status';

/** Bits the PC's shell knows (`src-tauri/src/remote_power.rs`). */
export const BUSY_SYNC = 1;
export const BUSY_BACKUP = 2;
/** How often the PC's busy state is looked at. A shutdown is never quicker than its 10 s countdown. */
export const BUSY_EVERY_MS = 2000;

/** What Nemo in this window is busy with right now. */
export function busyBits(): number {
  const sync = useSyncStatus.getState().phase === 'syncing' ? BUSY_SYNC : 0;
  return sync | (autoBackupRunning() ? BUSY_BACKUP : 0);
}

/**
 * Desktop: tells the shell what Nemo is busy with (cloud sync, backup), so a phone that wants to
 * switch the PC off hears it first. Sent on change only; nothing is stored. A no-op where this PC
 * cannot be controlled. Returns the stop function.
 */
export function startRemoteBusyReport(read: () => number = busyBits): () => void {
  const host = getPlatform().remoteHost;
  if (!host.supported) return () => undefined;
  let told = -1;
  const look = () => {
    const bits = read();
    if (bits === told) return;
    told = bits;
    // the hub may not run: the next change tells again
    host.reportBusy(bits).catch(() => {
      told = -1;
    });
  };
  look();
  const timer = setInterval(look, BUSY_EVERY_MS);
  return () => clearInterval(timer);
}
