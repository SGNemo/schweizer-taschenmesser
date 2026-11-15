import type { DriveInfo } from '@/core/platform/disk';
import type { CareHealth } from '@/core/platform/optimize';

/** Never more than this many warnings at once; the rest can wait. */
export const MAX_ADVICE = 3;

/** A drive the PC's care is about: built in, not plugged in over USB, not a network or RAM drive. */
const builtIn = (d: DriveInfo): boolean => d.kind === 'fixed' && d.bus !== 'usb';

/**
 * Built-in drives that report problems – the one thing the block above the drives says, because
 * the card keeps it folded under "Details". An unknown health state says nothing.
 */
export function troubledDrives(drives: readonly DriveInfo[]): DriveInfo[] {
  return drives.filter((d) => builtIn(d) && d.health.status === 'warning').slice(0, MAX_ADVICE);
}

/**
 * Whether an almost full drive's card offers the tidy tab as its next step: only the system
 * drive, because the places that tab looks at usually live there (temp, caches). Another
 * full drive has its own "Scannen" as the step that can help.
 */
export const tidyHelps = (d: DriveInfo, level: 'ok' | 'tight' | 'full'): boolean =>
  level === 'full' && d.isSystem && builtIn(d);

/**
 * The TRIM fact of a drive's details: only for a built-in SSD with NTFS (the switch Windows
 * reports is the NTFS one) and only when the state is known. `null` = say nothing.
 */
export function trimFact(d: DriveInfo, health: CareHealth | null): 'on' | 'off' | null {
  if (!builtIn(d) || d.media !== 'ssd' || d.fileSystem !== 'NTFS') return null;
  if (health?.trimOff == null) return null;
  return health.trimOff ? 'off' : 'on';
}
