import { useDeviceLines, type StatusLine } from '@/core/status/lines';
import { summaryText, needingLook } from '@/core/status/summary';
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

/** Everything the page shows, in four groups; the summary speaks about the four core lines. */
export function useDeviceStatus(): { groups: StatusGroup[]; summary: string; look: number } {
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
  const counted = [core.sync, core.backup, core.updates, core.storage];
  return { groups, summary: summaryText(counted), look: needingLook(counted).length };
}
