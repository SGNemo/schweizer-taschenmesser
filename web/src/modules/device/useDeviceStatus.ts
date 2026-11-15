import { anyLoading, useDeviceLines, useSettled, type StatusLine } from '@/core/status/lines';
import { calmPoint, needingLook } from '@/core/status/summary';
import { t } from '@/strings';
import {
  useAutostartLine,
  useDriveLine,
  useLanHubLine,
  useNetworkLine,
  useNextBackupLine,
} from './lines';

export interface StatusGroup {
  id: 'backup' | 'sync' | 'storage' | 'app';
  title: string;
  lines: StatusLine[];
}

const present = (lines: (StatusLine | undefined)[]): StatusLine[] =>
  lines.filter((l): l is StatusLine => l !== undefined);

/**
 * Everything the page shows, in four groups. The head counts every line of the page that needs a look (the four core
 * lines, plus a backup without its passphrase and a hub that is not reachable). `ready` turns true once the first
 * reads of all lines are back (or after `STATUS_WAIT_MS`): the page shows its head and lines then, all at once, so
 * they never fill in one by one and no line says "Kein Backup" before the last backup is read.
 */
export function useDeviceStatus(): {
  groups: StatusGroup[];
  /** The lines of the page that need a look. */
  look: StatusLine[];
  /** `true` = nothing needs a look, but there is no backup yet: the head says so calmly. */
  noBackup: boolean;
  ready: boolean;
} {
  const core = useDeviceLines();
  const g = t.device.groups;
  const groups: StatusGroup[] = [
    { id: 'backup', title: g.backup, lines: present([core.backup, useNextBackupLine()]) },
    { id: 'sync', title: g.sync, lines: present([core.sync, useLanHubLine()]) },
    { id: 'storage', title: g.storage, lines: present([core.storage, useDriveLine()]) },
    {
      id: 'app',
      title: g.app,
      lines: present([core.updates, useAutostartLine(), useNetworkLine()]),
    },
  ];
  const all = groups.flatMap((g) => g.lines);
  const ready = useSettled(!anyLoading(all));
  // A line whose read hangs past the wait and has no words yet stays out; the rest shows (with its fallback words).
  const shown = groups
    .map((g) => ({ ...g, lines: g.lines.filter((l) => !(l.loading && !l.status)) }))
    .filter((g) => g.lines.length > 0);
  return { groups: shown, look: needingLook(all), noBackup: calmPoint(all) !== undefined, ready };
}
