import {
  anyLoading,
  useBackupLine,
  useSettled,
  useSyncLine,
  useUpdatesLine,
  type StatusLine,
} from '@/core/status/lines';
import { calmPoint, needingLook, summaryText, withTitle } from '@/core/status/summary';
import { Skeleton, StatusWidget } from '@/ui';
import { useLanHubLine, useNextBackupLine } from '../lines';

/**
 * How this device is doing, in one sentence (catalogue type: status). It counts every line the page's head counts that
 * can need a look (sync, backup, updates, the next backup, the home-network hub; storage never carries a mark, so it is
 * not read here), so the widget never says "Nichts Dringendes" while the page it opens names a point. Words of the states only, never an address, a device name or a
 * path; the widget's header leads to the page. Like the page, it speaks once the first reads are back (never "Kein
 * Backup" before the last backup is read). No backup yet and nothing else: "Noch kein Backup", calm (no alert, no
 * warning tone), and the hint leaves the backup out so it is not said twice.
 */
export default function DeviceWidget() {
  const sync = useSyncLine();
  const backup = useBackupLine();
  const read = [sync, backup, useUpdatesLine(), useNextBackupLine(), useLanHubLine()];
  const ready = useSettled(!anyLoading(read));
  if (!ready) return <Skeleton width="60%" height="1.25rem" />;
  // A read that hangs past the wait has no words: it is left out, not counted as "all well" or as a point.
  const counted = read.filter((l): l is StatusLine => l !== undefined && !(l.loading && !l.status));
  const look = needingLook(counted).length > 0;
  const calm = calmPoint(counted);
  return (
    <StatusWidget
      icon={look ? 'alert' : 'ok'}
      state={summaryText(counted)}
      hint={[backup, sync]
        .filter((l) => counted.includes(l) && l !== calm)
        .map(withTitle)
        .join(' · ')}
      tone={look ? 'warning' : 'neutral'}
    />
  );
}
