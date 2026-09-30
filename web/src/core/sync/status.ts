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
  /** What the last successful cycle did. */
  lastResult?: { pulled: number; applied: number; pushed: number; rejected: number };
  /** Received changes that could not be decrypted and were dropped (summed since start). */
  rejected: number;
  /** Failed cycles in a row; 0 after a success. */
  failures: number;
  /** Epoch ms of the last failure. */
  errorAt?: number;
  /** Epoch ms of the next automatic retry (only for errors that can heal by themselves). */
  retryAt?: number;
  /** Size of the data on the server, when it could be read. */
  serverStats?: { records: number; fields: number; bytes: number; devices: number };
  set(patch: Partial<Omit<SyncStatusState, 'set'>>): void;
}

/** UI-facing sync status (kept out of the database: it is transient). */
export const useSyncStatus = create<SyncStatusState>((set) => ({
  phase: 'off',
  encrypted: false,
  pending: 0,
  rejected: 0,
  failures: 0,
  set: (patch) => set(patch),
}));
