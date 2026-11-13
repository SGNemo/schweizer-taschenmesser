import { INTERVAL_MS, type AutoBackupConfig, type AutoBackupLast } from '@/core/backup/auto';
import type { DriveInfo } from '@/core/platform/disk';
import type { LanHubStatus } from '@/core/platform/types';

/**
 * When the next automatic backup runs. `manual` = this platform has none (browser: backups are files the user
 * saves), `off` = switched off, `due` = it runs at the app's next check, `planned` = at `at`.
 */
export type NextBackup =
  { state: 'manual' } | { state: 'off' } | { state: 'due' } | { state: 'planned'; at: number };

export function nextBackup(
  supported: boolean,
  config: AutoBackupConfig,
  last: AutoBackupLast | undefined,
  at: number,
): NextBackup {
  if (!supported) return { state: 'manual' };
  if (!config.enabled) return { state: 'off' };
  // Same rule as `isDue` in core/backup/auto.ts: a failed or missing run is tried again at the next check.
  if (!last?.ok) return { state: 'due' };
  const next = last.at + INTERVAL_MS[config.interval];
  return next <= at ? { state: 'due' } : { state: 'planned', at: next };
}

/** The drive this page speaks about: the one that holds the system, else the first fixed one. */
export function mainDrive(drives: readonly DriveInfo[]): DriveInfo | undefined {
  return (
    drives.find((d) => d.isSystem && d.totalBytes > 0) ??
    drives.find((d) => d.kind === 'fixed' && d.totalBytes > 0)
  );
}

/** What the page says about the home-network hub: three words, never its port, address or a device name. */
export type HubState = 'listening' | 'off' | 'failed';
export const hubState = (status: Pick<LanHubStatus, 'state'>): HubState =>
  status.state === 'listening' ? 'listening' : status.state === 'failed' ? 'failed' : 'off';
