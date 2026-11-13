import { useDeviceLines } from '@/core/status/lines';
import { needingLook, summaryText, withTitle } from '@/core/status/summary';
import { StatusWidget } from '@/ui';
import { useLanHubLine, useNextBackupLine } from '../lines';

/**
 * How this device is doing, in one sentence (catalogue type: status). It counts what the page's head counts that can
 * need a look (the four core lines, the next backup, the home-network hub), so the widget never says "Nichts
 * Dringendes" while the page it opens names a point. Words of the states only, never an address, a device name or a
 * path; the widget's header leads to the page.
 */
export default function DeviceWidget() {
  const { sync, backup, updates, storage } = useDeviceLines();
  const counted = [sync, backup, updates, storage, useNextBackupLine(), useLanHubLine()].filter(
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
