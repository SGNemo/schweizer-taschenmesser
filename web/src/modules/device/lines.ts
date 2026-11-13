/**
 * The lines only this page shows: next backup, home-network hub, drive, autostart, network block. Read-only: each
 * hook asks the platform or the core for a state and names the settings page where it is set. A line that does not
 * exist on this platform is `undefined` (the page filters by `getPlatform().kind`; `manifest.platforms` is for the
 * whole module). Two of them can need a look: an automatic backup without its passphrase and a hub that is switched
 * on but not reachable; the page's head counts them, the widget and the settings count the four core lines.
 * The drive line reads the drive list (sizes of the mounted drives, what "Dieser PC" shows); it scans nothing.
 */
import { useEffect, useState } from 'react';
import { hasAutoPassphrase, loadAutoConfig, loadAutoLast } from '@/core/backup/auto';
import { formatTimestamp } from '@/core/i18n/format';
import { useNetLog } from '@/core/net/netlog';
import { getPlatform } from '@/core/platform';
import { settingsPath } from '@/core/settings/registry/paths';
import { formatBytes } from '@/core/settings/storageInfo';
import type { StatusLine } from '@/core/status/lines';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { hubState, mainDrive, nextBackup, type HubState, type NextBackup } from './logic';

/** Resolves once per mount; `undefined` while loading, on a platform without the thing, and when the read fails. */
function useRead<T>(read: (() => Promise<T>) | undefined): T | undefined {
  const [value, setValue] = useState<T>();
  const on = read !== undefined;
  useEffect(() => {
    if (!read) return;
    let live = true;
    void read().then(
      (v) => live && setValue(v),
      () => undefined,
    );
    return () => {
      live = false;
    };
    // The readers are stable per platform; only "exists here" can differ.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);
  return value;
}

const line = (
  id: string,
  icon: StatusLine['icon'],
  to: string,
  title: string,
  status: string,
  context: string,
  attention = false,
): StatusLine => ({
  id,
  icon,
  to,
  title,
  status,
  context,
  attention,
  testId: `device-${id}`,
});

export function useNextBackupLine(): StatusLine | undefined {
  const d = t.device.nextBackup;
  const supported = getPlatform().isNative;
  const next = useRead<NextBackup>(async () => {
    // Only whether a passphrase is stored, never its value.
    const [config, last, hasPassphrase] = await Promise.all([
      loadAutoConfig(),
      loadAutoLast(),
      supported ? hasAutoPassphrase() : Promise.resolve(false),
    ]);
    return nextBackup(supported, config, last, hasPassphrase, now());
  });
  if (!next) return undefined;
  const [status, context] =
    next.state === 'manual'
      ? [d.manual, d.manualContext]
      : next.state === 'off'
        ? [d.off, d.offContext]
        : next.state === 'no-passphrase'
          ? [d.noPassphrase, d.noPassphraseContext]
          : next.state === 'due'
            ? [d.due, d.dueContext]
            : [formatTimestamp(next.at), d.plannedContext];
  return line(
    'next-backup',
    'calendarDays',
    settingsPath('sync', 'backup'),
    d.title,
    status,
    context,
    next.state === 'no-passphrase',
  );
}

export function useLanHubLine(): StatusLine | undefined {
  const d = t.device.hub;
  const platform = getPlatform();
  const here = platform.kind === 'desktop' && platform.lanHub.supported;
  const hub = useRead<{ state: HubState; devices: number }>(
    here
      ? async () => {
          // Only the state word and a count leave this call: never the port, the QR payload or a device's name.
          const s = await platform.lanHub.status();
          return { state: hubState(s), devices: s.devices };
        }
      : undefined,
  );
  if (!hub) return undefined;
  const context =
    hub.state === 'listening'
      ? d.devices(hub.devices)
      : hub.state === 'failed'
        ? d.failedContext
        : d.offContext;
  return line(
    'hub',
    'wifi',
    '/settings/sync',
    d.title,
    d.state[hub.state],
    context,
    hub.state === 'failed',
  );
}

export function useDriveLine(): StatusLine | undefined {
  const d = t.device.drive;
  const platform = getPlatform();
  const here = platform.kind === 'desktop' && platform.disk.supported;
  const drive = useRead(
    here ? async () => mainDrive(await platform.disk.listDrives()) ?? null : undefined,
  );
  if (!drive) return undefined;
  // Sizes only: no drive letter, label, model or folder.
  return line(
    'drive',
    'disk',
    settingsPath('allgemein', 'storage'),
    d.title,
    d.free(formatBytes(drive.freeBytes)),
    d.context(formatBytes(drive.totalBytes)),
  );
}

export function useAutostartLine(): StatusLine | undefined {
  const d = t.device.autostart;
  const platform = getPlatform();
  const here = platform.kind === 'desktop' && platform.desktop.supported;
  const on = useRead(here ? () => platform.desktop.autostart() : undefined);
  if (on === undefined) return undefined;
  return line(
    'autostart',
    'play',
    settingsPath('schnellerfassung', 'quickcapture', 'autostart'),
    d.title,
    on ? d.on : d.off,
    on ? d.onContext : d.offContext,
  );
}

export function useNetworkLine(): StatusLine {
  const d = t.device.network;
  const blocked = useNetLog((s) => s.blocked);
  return line(
    'network',
    'network',
    settingsPath('verbindungen', 'network'),
    d.title,
    blocked ? d.blocked : d.open,
    blocked ? d.blockedContext : d.openContext,
  );
}
