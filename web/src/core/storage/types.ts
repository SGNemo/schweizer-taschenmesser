import type { FieldOp } from '@/core/sync/types';

export interface OutboxEntry {
  collection: string;
  id: string;
  /** Write counter of the record when the ops were read. */
  rev: number;
}

export interface OutboxBatch {
  ops: FieldOp[];
  entries: OutboxEntry[];
}

export interface ApplyResult {
  /** Fields that changed locally. */
  applied: number;
  /** Records touched. */
  records: number;
  /** Ops for collections this app version does not know. */
  skippedUnknown: number;
  /** Fields where a remote edit met a local edit that was not synced yet (logged for review). */
  conflicts?: number;
}

/**
 * Local store as seen by the sync engine. The app always works against IndexedDB; sync is a
 * separate layer that only talks to this interface.
 */
export interface StorageAdapter {
  /** Ops of up to `maxRecords` records that changed locally and were not pushed yet. */
  readOutbox(maxRecords: number): Promise<OutboxBatch>;
  /** Clears entries that did not change again since they were read. */
  acknowledge(entries: OutboxEntry[]): Promise<void>;
  /** Merges remote ops (greatest HLC per field wins). `markDirty` queues touched records for pushing. */
  applyRemote(ops: FieldOp[], opts?: { markDirty?: boolean }): Promise<ApplyResult>;
  /** Queues every synced record, e.g. for the first upload to a new server. */
  markAllDirty(): Promise<void>;
  pendingCount(): Promise<number>;
  getCursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
  getEpoch(): Promise<string | undefined>;
  setEpoch(epoch: string | undefined): Promise<void>;
}
