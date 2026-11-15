/**
 * The lines only this page shows: next backup, home-network hub, drive, autostart, network block. Read-only: each
 * hook asks the platform or the core for a state and names the settings page where it is set. A line that does not
 * exist on this platform is `undefined` (the page filters by `getPlatform().kind`; `manifest.platforms` is for the
 * whole module). Two of them can need a look: an automatic backup without its passphrase and a hub that is switched
 * on but not reachable; the page's head and the widget count them, the settings line counts the four core lines.
 * The drive line reads the drive list (sizes of the mounted drives, what "Dieser PC" shows); it scans nothing.
 * While a read that exists here has not come back, a hook returns a line with `loading` (no words yet), so the page
 * can wait for it; a read that fails or finds nothing leaves no line.
 */
import { hasAutoPassphrase, loadAutoConfig, loadAutoLast } from '@/core/backup/auto';
import { formatTimestamp } from '@/core/i18n/format';
import { useNetLog } from '@/core/net/netlog';
import { getPlatform } from '@/core/platform';
import { settingsPath } from '@/core/settings/registry/paths';
import { formatBytes } from '@/core/settings/storageInfo';
import { useRead, type StatusLine } from '@/core/status/lines';
import { now } from '@/core/time/now';
import { t } from '@/strings';
import { tLanSync } from '@/strings.lanSync';
import { hubState, mainDrive, nextBackup, type HubState, type NextBackup } from './logic';

/** A title of the settings ("Windows blockiert den Abgleich.") as a state word: without its full stop. */
const withoutStop = (text: string): string => text.replace(/\.$/, '');

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

/** The line while its read is on the way: no state yet, nothing marked. */
const pending = (id: string, icon: StatusLine['icon'], to: string, title: string): StatusLine => ({
  ...line(id, icon, to, title, '', ''),
  loading: true,
});

export function useNextBackupLine(): StatusLine | undefined {
  const d = t.device.nextBackup;
  const supported = getPlatform().isNative;
  const { value: next, done } = useRead<NextBackup>(async () => {
    // Only a yes/no leaves the core (`hasAutoPassphrase`); a keystore that cannot be read keeps the line as it was.
    const [config, last, hasPassphrase] = await Promise.all([
      loadAutoConfig(),
      loadAutoLast(),
      supported ? hasAutoPassphrase().catch(() => true) : Promise.resolve(false),
    ]);
    return nextBackup(supported, config, last, hasPassphrase, now());
  });
  const to = settingsPath('sync', 'backup');
  if (!done) return pending('next-backup', 'calendarDays', to, d.title);
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
    to,
    d.title,
    status,
    context,
    next.state === 'no-passphrase',
  );
}

export function useLanHubLine(): StatusLine | undefined {
  const d = t.device.hub;
  const l = tLanSync.use();
  const platform = getPlatform();
  const here = platform.kind === 'desktop' && platform.lanHub.supported;
  const { value: hub, done } = useRead<{ state: HubState; devices: number }>(
    here
      ? async () => {
          // Only the state word and a count leave this call: never the port, the QR payload or a device's name.
          const s = await platform.lanHub.status();
          return { state: hubState(s), devices: s.devices };
        }
      : undefined,
  );
  if (!done) return pending('hub', 'wifi', '/settings/sync', d.title);
  if (!hub) return undefined;
  // A hub that the network holds off (public network, another network than at pairing, no home network) is not "Aus": it says why, in
  // the words of the settings' section "Im Heimnetz", and carries no mark (nothing broke; the section shows the way).
  const [status, context] =
    hub.state === 'public-network'
      ? [withoutStop(l.blocked), l.blockedLine]
      : hub.state === 'no-home'
        ? [l.onlyHome, l.onlyHomeLine]
        : hub.state === 'no-network'
          ? [l.noNetwork, l.noNetworkLine]
          : [
              d.state[hub.state],
              hub.state === 'listening'
                ? d.devices(hub.devices)
                : hub.state === 'failed'
                  ? d.failedContext
                  : d.offContext,
            ];
  return line('hub', 'wifi', '/settings/sync', d.title, status, context, hub.state === 'failed');
}

export function useDriveLine(): StatusLine | undefined {
  const d = t.device.drive;
  const platform = getPlatform();
  const here = platform.kind === 'desktop' && platform.disk.supported;
  const to = settingsPath('allgemein', 'storage');
  const { value: drive, done } = useRead(
    here ? async () => mainDrive(await platform.disk.listDrives()) ?? null : undefined,
  );
  if (!done) return pending('drive', 'disk', to, d.title);
  if (!drive) return undefined;
  // Sizes only: no drive letter, label, model or folder.
  return line(
    'drive',
    'disk',
    to,
    d.title,
    d.free(formatBytes(drive.freeBytes)),
    d.context(formatBytes(drive.totalBytes)),
  );
}

export function useAutostartLine(): StatusLine | undefined {
  const d = t.device.autostart;
  const platform = getPlatform();
  const here = platform.kind === 'desktop' && platform.desktop.supported;
  const to = settingsPath('schnellerfassung', 'quickcapture', 'autostart');
  const { value: on, done } = useRead(here ? () => platform.desktop.autostart() : undefined);
  if (!done) return pending('autostart', 'play', to, d.title);
  if (on === undefined) return undefined;
  return line('autostart', 'play', to, d.title, on ? d.on : d.off, on ? d.onContext : d.offContext);
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
