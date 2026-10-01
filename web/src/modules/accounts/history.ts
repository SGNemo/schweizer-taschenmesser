/**
 * The last generated passwords, in memory only: never persisted, never synced, dropped as soon as the
 * vault locks (the same moment every decrypted value goes away).
 */
import { create } from 'zustand';
import { useSession } from './session';

export const HISTORY_SIZE = 5;

interface HistoryState {
  items: string[];
}

export const useGeneratedHistory = create<HistoryState>(() => ({ items: [] }));

/** Newest first, no duplicates, at most {@link HISTORY_SIZE}. */
export function recordGenerated(value: string): void {
  if (!value) return;
  useGeneratedHistory.setState((s) => ({
    items: [value, ...s.items.filter((x) => x !== value)].slice(0, HISTORY_SIZE),
  }));
}

export const clearGeneratedHistory = (): void => useGeneratedHistory.setState({ items: [] });

useSession.subscribe((s) => {
  if (s.session.status === 'locked') clearGeneratedHistory();
});
