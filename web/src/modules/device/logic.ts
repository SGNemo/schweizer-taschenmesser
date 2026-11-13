import { INTERVAL_MS, isDue, type AutoBackupConfig, type AutoBackupLast } from '@/core/backup/auto';
import type { DriveInfo } from '@/core/platform/disk';
import type { LanHubStatus } from '@/core/platform/types';

/**
 * When the next automatic backup runs. `manual` = this platform has none (browser: backups are files the user
 * saves), `off` = switched off, `no-passphrase` = switched on, but no passphrase is stored, so the runner skips every
 * time (`runAutoBackup`: `no-passphrase`), `due` = it runs at the app's next check, `planned` = at `at`.
 */
export type NextBackup =
  | { state: 'manual' }
  | { state: 'off' }
  | { state: 'no-passphrase' }
  | { state: 'due' }
  | { state: 'planned'; at: number };

export function nextBackup(
  supported: boolean,
  config: AutoBackupConfig,
  last: AutoBackupLast | undefined,
  hasPassphrase: boolean,
  at: number,
): NextBackup {
  if (!supported) return { state: 'manual' };
  if (!config.enabled) return { state: 'off' };
  if (!hasPassphrase) return { state: 'no-passphrase' };
  // The runner's own rule: a failed or missing run is tried again at the next check.
  if (!last?.ok || isDue(config, last, at)) return { state: 'due' };
  // `isDue` is the runner's rule (a missing or failed run is due); `last?.ok` only narrows the type here.
  return { state: 'planned', at: last.at + INTERVAL_MS[config.interval] };
}

/** The drive this page speaks about: the one that holds the system (the line says so); none, no line. */
export const mainDrive = (drives: readonly DriveInfo[]): DriveInfo | undefined =>
  drives.find((d) => d.isSystem && d.totalBytes > 0);

/** What the page says about the home-network hub: three words, never its port, address or a device name. */
export type HubState = 'listening' | 'off' | 'failed';
export const hubState = (status: Pick<LanHubStatus, 'state'>): HubState =>
  status.state === 'listening' ? 'listening' : status.state === 'failed' ? 'failed' : 'off';
