import { create } from 'zustand';
import type { DriveInfo } from '@/core/platform/disk';
import { now } from '@/core/time/now';

/** Points kept per drive (a few minutes at the page's refresh rate). */
export const MAX_POINTS = 120;

export interface UsagePoint {
  at: number;
  usedBytes: number;
}

interface LastScan {
  at: number;
  usedBytes: number;
}

interface HistoryState {
  /** Used bytes per drive root since the app started. Memory only: nothing is stored or synced. */
  points: Record<string, UsagePoint[]>;
  lastScan: Record<string, LastScan>;
  record(drives: readonly DriveInfo[]): void;
  /** Remembers a finished scan of a whole drive. */
  recordScan(root: string, usedBytes: number): void;
}

export const useDriveHistory = create<HistoryState>((set) => ({
  points: {},
  lastScan: {},
  record(drives) {
    const at = now();
    set((s) => {
      const points = { ...s.points };
      for (const d of drives) {
        const used = Math.max(0, d.totalBytes - d.freeBytes);
        const list = points[d.root] ?? [];
        // Equal consecutive values add nothing to a sparkline of a quiet drive.
        if (list.length > 0 && list[list.length - 1]!.usedBytes === used) continue;
        points[d.root] = [...list, { at, usedBytes: used }].slice(-MAX_POINTS);
      }
      return { points };
    });
  },
  recordScan(root, usedBytes) {
    set((s) => ({ lastScan: { ...s.lastScan, [root]: { at: now(), usedBytes } } }));
  },
}));

/** Change of a drive's used space since its last scan; `null` without a scan or a reading. */
export function growthSinceScan(
  scan: LastScan | undefined,
  current: UsagePoint | undefined,
): number | null {
  if (!scan || !current) return null;
  return current.usedBytes - scan.usedBytes;
}
