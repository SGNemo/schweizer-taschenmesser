import { create } from 'zustand';
import { getPlatform } from '@/core/platform';
import type { CleanupPlace, CleanupProgress } from '@/core/platform/optimize';
import {
  initialSelection,
  pruneSelection,
  refreshPlace,
  setAll,
  setRest,
  toggleItem,
  type Selection,
} from './logic/cleanup';

export type CleanupPhase = 'idle' | 'searching' | 'done' | 'failed';

interface CleanupState {
  phase: CleanupPhase;
  progress: CleanupProgress | null;
  places: CleanupPlace[];
  /** The search was stopped: the list may be incomplete. */
  cancelled: boolean;
  /** Ticked entries per suggestion (key: its scan id). */
  selection: Record<number, Selection>;
  /** Looks through the clean-up places. Nothing is changed; a running search is not restarted. */
  search(): Promise<void>;
  cancel(): Promise<void>;
  toggle(scanId: number, nodeId: number): void;
  toggleRest(scanId: number, on: boolean): void;
  toggleAll(scanId: number, on: boolean): void;
  /** After a delete run in a suggestion: re-reads what is left of it. */
  refresh(scanId: number): Promise<void>;
}

/** Each search gets a number, so the answer of an outdated one is ignored. */
let run = 0;

/**
 * The clean-up suggestions of this session. Kept in a store (not in the tab), so the result and
 * the ticks survive a change of tab or page; nothing is persisted, the scans live in memory on
 * the native side.
 */
export const useCleanupStore = create<CleanupState>((set, get) => ({
  phase: 'idle',
  progress: null,
  places: [],
  cancelled: false,
  selection: {},

  async search() {
    if (get().phase === 'searching') return;
    const mine = ++run;
    set({ phase: 'searching', progress: null, places: [], selection: {}, cancelled: false });
    try {
      const result = await getPlatform().disk.optimize.cleanupScan((progress) => {
        if (mine === run) set({ progress });
      });
      if (mine !== run) return;
      set({
        phase: 'done',
        progress: null,
        places: result.places,
        cancelled: result.cancelled,
        selection: Object.fromEntries(result.places.map((p) => [p.scanId, initialSelection(p)])),
      });
    } catch {
      if (mine === run) set({ phase: 'failed', progress: null });
    }
  },

  async cancel() {
    if (get().phase !== 'searching') return;
    await getPlatform()
      .disk.optimize.cancelCleanup()
      .catch(() => undefined);
  },

  toggle(scanId, nodeId) {
    const { selection } = get();
    const current = selection[scanId];
    if (current) set({ selection: { ...selection, [scanId]: toggleItem(current, nodeId) } });
  },

  toggleRest(scanId, on) {
    const { selection, places } = get();
    const place = places.find((p) => p.scanId === scanId);
    const current = selection[scanId];
    if (place && current)
      set({ selection: { ...selection, [scanId]: setRest(place, current, on) } });
  },

  toggleAll(scanId, on) {
    const { selection, places } = get();
    const place = places.find((p) => p.scanId === scanId);
    if (place) set({ selection: { ...selection, [scanId]: setAll(place, on) } });
  },

  async refresh(scanId) {
    const place = get().places.find((p) => p.scanId === scanId);
    if (!place) return;
    // The place's root is node 0 of its scan; its direct children are the suggested entries.
    const children = await getPlatform()
      .disk.children(scanId, 0, 1, 0)
      .catch(() => null);
    if (!children) return;
    const next = refreshPlace(place, children);
    const { places, selection } = get();
    const { [scanId]: old, ...others } = selection;
    set({
      places: next
        ? places.map((p) => (p.scanId === scanId ? next : p))
        : places.filter((p) => p.scanId !== scanId),
      selection: next && old ? { ...others, [scanId]: pruneSelection(next, old) } : others,
    });
  },
}));
