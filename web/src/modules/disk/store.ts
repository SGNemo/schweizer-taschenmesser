import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { DiskNode, ScanProgress, ScanSummary } from '@/core/platform/disk';
import { now } from '@/core/time/now';
import { useDriveHistory } from './history';

/** The status line takes a new figure at most this often (Rust reports every 100 ms). */
export const PROGRESS_MS = 1000;
/** How often the running scan is asked for its growing picture while the scan page is open. */
export const LIVE_POLL_MS = 1500;

/** What the basket needs to show an entry; the entry itself stays in the native scan tree. */
export interface BasketItem {
  id: number;
  name: string;
  bytes: number;
  files: number;
  isDir: boolean;
}

export type ScanPhase = 'idle' | 'scanning' | 'done' | 'failed';

interface DiskState {
  phase: ScanPhase;
  root: string | null;
  scanId: number | null;
  progress: ScanProgress | null;
  /**
   * The last live picture of the running scan (top folder levels, `liveScan`), so the page shows
   * the known part at once when the user comes back. Empty once the scan is done.
   */
  live: DiskNode[];
  summary: ScanSummary | null;
  error: string | null;
  paused: boolean;
  basket: BasketItem[];
  addToBasket(item: BasketItem): void;
  removeFromBasket(id: number): void;
  clearBasket(): void;
  /** After a delete run: the scan root's new totals. */
  applyRoot(root: DiskNode): void;
  start(root: string): Promise<void>;
  /** Fetches the live picture of the running scan (no-op when none runs). */
  pollLive(minBytes: number): Promise<void>;
  cancel(): Promise<void>;
  togglePause(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * The scan session of the disk module. Only in memory: nothing about a scan is persisted or synced.
 * The scan tree itself stays in the native side; this store only holds the summary, the progress
 * and the small live picture of a running scan.
 */
export const useDiskStore = create<DiskState>((set, get) => ({
  phase: 'idle',
  root: null,
  scanId: null,
  progress: null,
  live: [],
  summary: null,
  error: null,
  paused: false,
  basket: [],

  addToBasket(item) {
    set((s) => (s.basket.some((b) => b.id === item.id) ? s : { basket: [...s.basket, item] }));
  },
  removeFromBasket(id) {
    set((s) => ({ basket: s.basket.filter((b) => b.id !== id) }));
  },
  clearBasket() {
    set({ basket: [] });
  },
  applyRoot(root) {
    set((s) =>
      s.summary
        ? {
            summary: {
              ...s.summary,
              rootNode: root,
              bytes: root.bytes,
              logicalBytes: root.logicalBytes,
              files: root.files,
            },
          }
        : s,
    );
  },

  async start(root) {
    // Switch to the new scan at once: the scan page reads `phase` on its first render, and a
    // slow drop of the previous scan must never make it look idle (it would send the user back).
    const previous = get().scanId;
    set({
      phase: 'scanning',
      root,
      scanId: null,
      progress: null,
      live: [],
      error: null,
      summary: null,
      paused: false,
      basket: [],
    });
    const disk = getPlatform().disk;
    if (previous !== null) void disk.dropScan(previous).catch(() => undefined);
    try {
      let shownAt = -Infinity;
      const handle = await disk.startScan(root, (progress) => {
        if (get().root !== root || get().phase !== 'scanning') return;
        // A calm line: a new figure at most once a second, not ten times (FOCUS-GUIDELINES).
        const at = now();
        if (at - shownAt < PROGRESS_MS) return;
        shownAt = at;
        set({ progress });
      });
      // Another scan was started meanwhile: this one is not wanted any more.
      if (get().root !== root || get().scanId !== null) {
        void disk.dropScan(handle.scanId).catch(() => undefined);
        return;
      }
      set({ scanId: handle.scanId });
      const summary = await handle.result;
      if (get().scanId === handle.scanId) {
        set({ phase: 'done', summary, paused: false, live: [] });
        // Baseline for "Belegt seit letztem Scan": the drive's used space at this moment.
        const history = useDriveHistory.getState();
        const used = history.points[root]?.at(-1)?.usedBytes;
        if (used !== undefined && !summary.cancelled) history.recordScan(root, used);
      }
    } catch (e) {
      set({ phase: 'failed', error: e instanceof Error ? e.message : 'error' });
    }
  },

  async pollLive(minBytes) {
    const { scanId, phase } = get();
    if (scanId === null || phase !== 'scanning') return;
    try {
      const live = await getPlatform().disk.liveScan(scanId, minBytes);
      if (get().scanId === scanId && get().phase === 'scanning') set({ live });
    } catch {
      // The scan ended or was dropped meanwhile; the next phase change replaces the picture.
    }
  },

  async cancel() {
    const { scanId, phase } = get();
    if (scanId !== null && phase === 'scanning') await getPlatform().disk.cancelScan(scanId);
  },

  async togglePause() {
    const { scanId, phase, paused } = get();
    if (scanId === null || phase !== 'scanning') return;
    await getPlatform().disk.pauseScan(scanId, !paused);
    set({ paused: !paused });
  },

  async reset() {
    const { scanId } = get();
    set({
      phase: 'idle',
      root: null,
      scanId: null,
      progress: null,
      live: [],
      summary: null,
      error: null,
      paused: false,
      basket: [],
    });
    if (scanId !== null) {
      try {
        await getPlatform().disk.dropScan(scanId);
      } catch {
        // Already gone on the native side.
      }
    }
  },
}));
