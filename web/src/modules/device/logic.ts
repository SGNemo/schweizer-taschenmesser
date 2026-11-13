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
  // `isDue` is the runner's rule (a missing or failed run is tried again at the next check);
  // `!last?.ok` narrows the type.
  if (!last?.ok || isDue(config, last, at)) return { state: 'due' };
  return { state: 'planned', at: last.at + INTERVAL_MS[config.interval] };
}

/** The drive this page speaks about: the one that holds the system (the line says so); none, no line. */
export const mainDrive = (drives: readonly DriveInfo[]): DriveInfo | undefined =>
  drives.find((d) => d.isSystem && d.totalBytes > 0);

/**
 * What the page says about the home-network hub, never its port, address or a device name. `public-network`,
 * `no-home` and `no-network` = switched on, but held off by the network it is in (Windows calls it public; another
 * network than the one it was paired in; no home network at all): not "off", and nothing broke.
 */
export type HubState = 'listening' | 'off' | 'failed' | 'public-network' | 'no-home' | 'no-network';
export const hubState = (status: Pick<LanHubStatus, 'state' | 'reason'>): HubState =>
  status.state === 'listening'
    ? 'listening'
    : status.state === 'failed'
      ? 'failed'
      : status.reason === 'public-network' ||
          status.reason === 'no-home' ||
          status.reason === 'no-network'
        ? status.reason
        : 'off';
