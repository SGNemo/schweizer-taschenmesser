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
  applyRemote(
    ops: FieldOp[],
    opts?: {
      markDirty?: boolean;
      /** The ops were pulled before (a restarted cursor): merged as usual, never logged as a conflict. */
      replay?: boolean;
    },
  ): Promise<ApplyResult>;
  /** Queues every synced record, e.g. for the first upload to a new server. */
  markAllDirty(): Promise<void>;
  pendingCount(): Promise<number>;
  getCursor(): Promise<number>;
  setCursor(cursor: number): Promise<void>;
  getEpoch(): Promise<string | undefined>;
  setEpoch(epoch: string | undefined): Promise<void>;
  /**
   * Device-local note whether the last pull ended complete (`more: false`). `pullAll` clears it when a
   * pull starts and sets it when the last page was applied; a paged or failed pull leaves it cleared.
   * `core/sync/service.ts` `syncSettled()` reads it. Optional: test doubles need not keep it.
   */
  setPullComplete?(complete: boolean): Promise<void>;
  /**
   * Cursor repair for tables a newer app version syncs: ops of a table this device did not know were
   * dropped while the cursor moved on (`applyRemote`, `skippedUnknown`). The store keeps the set of
   * synced table names (device-local); when the set has a name the stored one lacks, the pull cursor
   * restarts at 0 once – re-applying is idempotent – and the new set is stored. Returns whether it
   * restarted. `runSync` calls it before every round, for every transport (they share this store).
   * Optional: test doubles need not keep it.
   */
  restartForNewTables?(): Promise<boolean>;
  /**
   * The cursor the last restart replaced: a page that starts below it was pulled before and is a replay
   * (`applyRemote` `replay`). 0 when there was none; cleared when the remote data set changes.
   */
  getReplayUntil?(): Promise<number>;
}
