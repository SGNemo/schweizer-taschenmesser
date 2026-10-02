import { create } from 'zustand';
import type { AttentionItem } from './types';

interface LiveAttention {
  /** Items by publisher id. Memory only; a publisher clears its items when it unmounts. */
  bySource: Record<string, AttentionItem[]>;
  publish(source: string, items: AttentionItem[]): void;
  clear(source: string): void;
}

/**
 * For things that are not in the database (e.g. a drive that is almost full, read from the system):
 * a widget publishes them here while it is on screen and the "Jetzt wichtig" strip shows them next
 * to the database-backed items from `contributions.attention`.
 */
export const useLiveAttention = create<LiveAttention>((set) => ({
  bySource: {},
  publish: (source, items) => set((s) => ({ bySource: { ...s.bySource, [source]: items } })),
  clear: (source) =>
    set((s) => {
      const { [source]: _gone, ...rest } = s.bySource;
      return { bySource: rest };
    }),
}));
