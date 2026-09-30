import { create } from 'zustand';
import type { SyncErrorCode } from './types';

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'error';

export interface SyncStatusState {
  phase: SyncPhase;
  /** Host of the configured server, for display. */
  server?: string;
  encrypted: boolean;
  /** Epoch ms of the last successful sync. */
  lastSyncAt?: number;
  error?: SyncErrorCode | 'unknown';
  /** Local records waiting to be pushed. */
  pending: number;
  set(patch: Partial<Omit<SyncStatusState, 'set'>>): void;
}

/** UI-facing sync status (kept out of the database: it is transient). */
export const useSyncStatus = create<SyncStatusState>((set) => ({
  phase: 'off',
  encrypted: false,
  pending: 0,
  set: (patch) => set(patch),
}));
