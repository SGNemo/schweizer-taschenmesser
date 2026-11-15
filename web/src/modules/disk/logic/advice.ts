import type { DriveInfo } from '@/core/platform/disk';
import type { CareHealth } from '@/core/platform/optimize';
import { percent } from '../format';
import { fillLevel } from './drives';

/** What a recommendation is about; the page maps it to its sentence and its one next step. */
export type AdviceKind = 'health' | 'full' | 'trimOff';

export interface Advice {
  kind: AdviceKind;
  /** The drive it is about (`null` for a fact of the whole PC). */
  root: string | null;
  /** `full`: bytes left on the drive. */
  freeBytes?: number;
}

/** Never more than this many at once: one thing at a time, the rest can wait. */
export const MAX_ADVICE = 3;

/**
 * Recommendations for the drives tab, most important first: a drive that reports problems, then
 * drives that are almost full (the system drive first), then TRIM switched off while an SSD is
 * built in. Only facts that are known: an unknown health state or TRIM state says nothing.
 * Network, removable and RAM drives are not the PC's to care for.
 */
export function adviceFor(drives: readonly DriveInfo[], health: CareHealth | null): Advice[] {
  const fixed = drives.filter((d) => d.kind === 'fixed');
  const out: Advice[] = [];
  for (const d of fixed)
    if (d.health.status === 'warning') out.push({ kind: 'health', root: d.root });
  const full = fixed
    .filter(
      (d) =>
        d.totalBytes > 0 &&
        fillLevel(percent(d.totalBytes - d.freeBytes, d.totalBytes), d.freeBytes) === 'full',
    )
    .sort((a, b) => Number(b.isSystem) - Number(a.isSystem) || a.freeBytes - b.freeBytes);
  for (const d of full) out.push({ kind: 'full', root: d.root, freeBytes: d.freeBytes });
  if (health?.trimOff === true && fixed.some((d) => d.media === 'ssd'))
    out.push({ kind: 'trimOff', root: null });
  return out.slice(0, MAX_ADVICE);
}
