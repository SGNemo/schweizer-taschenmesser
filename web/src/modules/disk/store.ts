import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { DiskNode, ScanProgress, ScanSummary } from '@/core/platform/disk';

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
  cancel(): Promise<void>;
  togglePause(): Promise<void>;
  reset(): Promise<void>;
}

/**
 * The scan session of the disk module. Only in memory: nothing about a scan is persisted or synced.
 * The scan tree itself stays in the native side; this store only holds the summary and progress.
 */
export const useDiskStore = create<DiskState>((set, get) => ({
  phase: 'idle',
  root: null,
  scanId: null,
  progress: null,
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
    await get().reset();
    set({ phase: 'scanning', root, progress: null, error: null, summary: null, paused: false });
    const disk = getPlatform().disk;
    try {
      const handle = await disk.startScan(root, (progress) => {
        if (get().root === root) set({ progress });
      });
      set({ scanId: handle.scanId });
      const summary = await handle.result;
      if (get().scanId === handle.scanId) set({ phase: 'done', summary, paused: false });
    } catch (e) {
      set({ phase: 'failed', error: e instanceof Error ? e.message : 'error' });
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
