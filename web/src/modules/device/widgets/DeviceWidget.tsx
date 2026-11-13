import { useBackupLine, useSyncLine, useUpdatesLine } from '@/core/status/lines';
import { needingLook, summaryText, withTitle } from '@/core/status/summary';
import { StatusWidget } from '@/ui';
import { useLanHubLine, useNextBackupLine } from '../lines';

/**
 * How this device is doing, in one sentence (catalogue type: status). It counts every line the page's head counts that
 * can need a look (sync, backup, updates, the next backup, the home-network hub; storage never carries a mark, so it is
 * not read here), so the widget never says "Nichts Dringendes" while the page it opens names a point. Words of the states only, never an address, a device name or a
 * path; the widget's header leads to the page.
 */
export default function DeviceWidget() {
  const sync = useSyncLine();
  const backup = useBackupLine();
  const counted = [sync, backup, useUpdatesLine(), useNextBackupLine(), useLanHubLine()].filter(
    (l) => l !== undefined,
  );
  const look = needingLook(counted).length > 0;
  return (
    <StatusWidget
      icon={look ? 'alert' : 'ok'}
      state={summaryText(counted)}
      hint={`${withTitle(backup)} · ${withTitle(sync)}`}
      tone={look ? 'warning' : 'neutral'}
    />
  );
}
