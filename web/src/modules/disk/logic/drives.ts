import { numberFormat } from '@/core/i18n/format';
import type { DriveInfo, DriveHealth } from '@/core/platform/disk';
import { driveLevel, type DriveLevel } from '../format';

const nf1 = () => numberFormat({ minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf0 = () => numberFormat({ maximumFractionDigits: 0 });
const GB = 1024 ** 3;
const TB = 1024 ** 4;

/**
 * Capacity for drive cards: always one decimal for GB and TB ("512,0 GB", "1,8 TB"), whole MB or
 * KB below a gigabyte. Powers of 1024, like Windows.
 */
export function formatCapacity(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '–';
  if (bytes >= TB) return `${nf1().format(bytes / TB)} TB`;
  if (bytes >= GB) return `${nf1().format(bytes / GB)} GB`;
  if (bytes >= 1024 ** 2) return `${nf0().format(bytes / 1024 ** 2)} MB`;
  return `${nf0().format(bytes / 1024)} KB`;
}

/** Signed change for "+3,2 GB" / "−1,1 GB"; below 100 MB it counts as unchanged. */
export function formatDelta(bytes: number): string {
  if (Math.abs(bytes) < 100 * 1024 ** 2) return '±0 GB';
  return `${bytes > 0 ? '+' : '−'}${formatCapacity(Math.abs(bytes))}`;
}

/** Key of the plain-language drive type shown as a chip. */
export type DriveType = 'nvme' | 'ssd' | 'hdd' | 'usb' | 'network' | 'removable' | 'ram' | 'drive';

export function driveType(d: Pick<DriveInfo, 'kind' | 'media' | 'bus'>): DriveType {
  if (d.kind === 'network') return 'network';
  if (d.kind === 'ram') return 'ram';
  if (d.bus === 'usb') return 'usb';
  if (d.kind === 'removable') return 'removable';
  if (d.bus === 'nvme') return 'nvme';
  if (d.media === 'ssd') return 'ssd';
  if (d.media === 'hdd') return 'hdd';
  return 'drive';
}

/** Interface shown next to the type ("NVMe", "SATA", "USB"); nothing for virtual or unknown ones. */
export function busLabel(bus: DriveInfo['bus']): string | null {
  return (
    (
      { nvme: 'NVMe', sata: 'SATA', usb: 'USB', scsi: 'SCSI/SAS', card: 'Speicherkarte' } as Record<
        string,
        string
      >
    )[bus] ?? null
  );
}

/**
 * Fill level with the thresholds of `driveLevel` (≥ 90 % full, ≥ 75 % tight); a drive with less
 * than 5 GB left also counts as full, however big it is.
 */
export function fillLevel(usedPercent: number, freeBytes: number): DriveLevel {
  const level = driveLevel(usedPercent);
  return level !== 'full' && freeBytes < 5 * GB ? 'full' : level;
}

export type HealthTone = 'ok' | 'warning' | 'muted';

/** What the health row says, in everyday words, and how it is toned. */
export function healthView(h: DriveHealth): {
  key: 'ok' | 'warning' | 'needsAdmin' | 'unsupported';
  tone: HealthTone;
} {
  if (h.status === 'ok') return { key: 'ok', tone: 'ok' };
  if (h.status === 'warning') return { key: 'warning', tone: 'warning' };
  return { key: h.gap === 'unsupported' ? 'unsupported' : 'needsAdmin', tone: 'muted' };
}
