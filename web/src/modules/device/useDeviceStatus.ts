import { useDeviceLines, type StatusLine } from '@/core/status/lines';
import { needingLook } from '@/core/status/summary';
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
 * lines, plus a backup without its passphrase and a hub that is not reachable).
 */
export function useDeviceStatus(): {
  groups: StatusGroup[];
  /** The lines of the page that need a look. */
  look: StatusLine[];
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
  return { groups, look: needingLook(groups.flatMap((g) => g.lines)) };
}
