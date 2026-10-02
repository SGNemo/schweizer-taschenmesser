import type { AttentionItem } from '@/core/modules/types';
import type { DriveInfo } from '@/core/platform/disk';
import { t } from '@/strings';
import { percent } from '../format';
import { fillLevel, formatCapacity } from './drives';

/** "Jetzt wichtig" entries for drives that are almost full (warning, never red). */
export function driveAttention(drives: readonly DriveInfo[]): AttentionItem[] {
  return drives
    .filter((d) => d.kind === 'fixed')
    .filter(
      (d) => fillLevel(percent(d.totalBytes - d.freeBytes, d.totalBytes), d.freeBytes) === 'full',
    )
    .map((d) => ({
      id: `disk:full:${d.root}`,
      tone: 'warning' as const,
      icon: 'disk' as const,
      title: t.attention.driveFull(t.disk.driveName(d.root, d.label)),
      detail: t.disk.free(formatCapacity(d.freeBytes)),
      to: '/disk',
      rank: 8,
    }));
}
