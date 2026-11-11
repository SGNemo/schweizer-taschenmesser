import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { Badge, Ring } from '@/ui';
import { Gauges, HeroFigure, HeroSlot } from '@/ui/identity';
import { percent } from '../format';
import { useDriveHistory } from '../history';
import { fillLevel, formatCapacity, headDrive, scanWhen } from '../logic/drives';
import styles from './DiskHead.module.css';

/** "438,7 GB" → value "438,7", unit "GB" (the unit sits small beside the mono figure). */
function splitCapacity(text: string): { value: string; unit: string } {
  const at = text.lastIndexOf(' ');
  return at < 0
    ? { value: text, unit: '' }
    : { value: text.slice(0, at), unit: text.slice(at + 1) };
}

/**
 * The `fortschritt` head of "Dieser PC" (identity v3.1, G01). Figure: used space of the system drive in mono, one
 * context line with the total, the free space, the state as a word on a badge (`fast voll` is a warning badge,
 * never a ring colour) and when the drive was last scanned. Signature (slot M, decoration like every signature
 * block): one ring per drive in the module hue with its name and percentage; before the first reading, the library's `Gauges` shape. Sizes only:
 * no file or folder names, nothing from a scan.
 */
export function DiskHead({ drives }: { drives: readonly DriveInfo[] | null }) {
  const main = drives ? headDrive(drives) : undefined;
  const lastScan = useDriveHistory((s) => (main ? s.lastScan[main.root] : undefined));
  return (
    <>
      {main ? <HeadFigure drive={main} lastScanAt={lastScan?.at} /> : null}
      <HeroSlot area="signature">
        {drives && drives.length > 0 ? (
          // Decoration like every signature block (aria-hidden): the figure and the drive cards say it in words.
          <ul className={styles.rings} aria-hidden="true" data-testid="disk-head-rings">
            {drives.map((d) => {
              const pct = percent(Math.max(0, d.totalBytes - d.freeBytes), d.totalBytes);
              const name = t.disk.driveName(d.root, d.label);
              return (
                <li key={d.root} className={styles.ring}>
                  {/* level stays `ok`: the hue fills the ring, the state is said in words below the figure */}
                  <Ring percent={pct} label={name} />
                  <span className={styles.ringName}>{name}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <Gauges size="M" />
        )}
      </HeroSlot>
    </>
  );
}

function HeadFigure({ drive: d, lastScanAt }: { drive: DriveInfo; lastScanAt?: number }) {
  const h = t.disk.head;
  const used = Math.max(0, d.totalBytes - d.freeBytes);
  const level = fillLevel(percent(used, d.totalBytes), d.freeBytes);
  const figure = splitCapacity(formatCapacity(used));
  const state = h.state[level];
  return (
    <>
      {/* Identity 4.0: the title row takes the one figure; its longer context lies in the page, under the head. */}
      <HeroSlot area="figure">
        <HeroFigure
          type="mono"
          detail={t.disk.driveName(d.root, d.label)}
          value={figure.value}
          unit={`${figure.unit} ${h.used}`}
          testId="disk-head-used"
        />
      </HeroSlot>
      <HeroSlot>
        <p className={styles.context} data-testid="disk-head-context">
          <span>
            {h.of(formatCapacity(d.totalBytes))} · {t.disk.free(formatCapacity(d.freeBytes))}
          </span>
          {state ? <Badge tone={level === 'full' ? 'warning' : 'neutral'}>{state}</Badge> : null}
          <span>{lastScanAt ? h.lastScan(scanWhen(lastScanAt)) : h.neverScanned}</span>
        </p>
      </HeroSlot>
    </>
  );
}
