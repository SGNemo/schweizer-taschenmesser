import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { HeroFigure, HeroSlot } from '@/ui/identity';
import { formatCapacity, headDrive } from '../logic/drives';

/** "438,7 GB" → value "438,7", unit "GB" (the unit sits small beside the mono figure). */
function splitCapacity(text: string): { value: string; unit: string } {
  const at = text.lastIndexOf(' ');
  return at < 0
    ? { value: text, unit: '' }
    : { value: text.slice(0, at), unit: text.slice(at + 1) };
}

/**
 * The head of "Dieser PC" (Identity 4.0): one figure in the title row, the used space of the system drive in mono,
 * named by the drive as its context line. Total, free space, the state as a word and the last scan stand on the
 * drive's own card below, so the page says them once (no ring strip and no second line under the head). Sizes
 * only: no file or folder names, nothing from a scan.
 */
export function DiskHead({ drives }: { drives: readonly DriveInfo[] | null }) {
  const main = drives ? headDrive(drives) : undefined;
  if (!main) return null;
  const figure = splitCapacity(formatCapacity(Math.max(0, main.totalBytes - main.freeBytes)));
  return (
    <HeroSlot area="figure">
      <HeroFigure
        type="mono"
        detail={t.disk.driveName(main.root, main.label)}
        value={figure.value}
        unit={`${figure.unit} ${t.disk.head.used}`}
        testId="disk-head-used"
      />
    </HeroSlot>
  );
}
