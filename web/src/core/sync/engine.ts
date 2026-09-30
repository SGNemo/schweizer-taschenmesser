import type { StorageAdapter } from '@/core/storage/types';
import { decryptOps, encryptOps, isEncrypted } from './crypto';
import { SyncError, type FieldOp, type SyncAdapter } from './types';

export interface EngineDeps {
  storage: StorageAdapter;
  adapter: SyncAdapter;
  /** Present when end-to-end encryption is on. */
  key?: CryptoKey;
  /** Ops per pull request. */
  pullLimit?: number;
  /** Records per push request. */
  pushRecords?: number;
}

export interface SyncResult {
  /** Ops received. */
  pulled: number;
  /** Fields that changed locally. */
  applied: number;
  /** Records sent. */
  pushed: number;
  /** Ops dropped because they were not valid ciphertext. */
  rejected: number;
  /** The remote was new, reset or replaced: everything local was queued for upload. */
  fullUpload: boolean;
}

/** Raised internally when the remote epoch changed between pull and push. */
class EpochChanged extends Error {}

const MAX_ROUNDS = 1000;
/** Server limit is 5000 ops and 8 MB per request; stay well below both. */
export const MAX_OPS_PER_REQUEST = 2000;
export const MAX_BYTES_PER_REQUEST = 3_000_000;

/**
 * Splits ops into requests of bounded count and size. Ops are independent (one field each), so a
 * record may span requests; the outbox entry is only cleared after every chunk was accepted.
 */
export function chunkOps(
  ops: FieldOp[],
  maxOps: number = MAX_OPS_PER_REQUEST,
  maxBytes: number = MAX_BYTES_PER_REQUEST,
): FieldOp[][] {
  const chunks: FieldOp[][] = [];
  let current: FieldOp[] = [];
  let bytes = 0;
  for (const op of ops) {
    const size = JSON.stringify(op.value ?? null).length + 120;
    if (current.length > 0 && (current.length >= maxOps || bytes + size > maxBytes)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(op);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/**
 * One sync cycle: pull everything new, then push local changes.
 *
 *  - Pull first, so a changed remote (new server, reset, restored backup) is detected before
 *    anything is pushed. When the epoch differs the cursor restarts at 0 and every local record
 *    is queued for upload; ops the remote already has are simply not "greater" and get ignored.
 *  - The cursor only advances after a page was applied; re-applying is idempotent.
 *  - Local outbox entries are cleared only if the record was not written again while pushing.
 */
export async function runSync(deps: EngineDeps): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, applied: 0, pushed: 0, rejected: 0, fullUpload: false };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await pullAll(deps, result);
      await pushAll(deps, result);
      return result;
    } catch (e) {
      if (!(e instanceof EpochChanged)) throw e;
    }
  }
  throw new SyncError('server', 'remote data set keeps changing');
}

async function adoptEpoch(deps: EngineDeps, epoch: string, result: SyncResult): Promise<void> {
  await deps.storage.setEpoch(epoch);
  await deps.storage.setCursor(0);
  await deps.storage.markAllDirty();
  result.fullUpload = true;
}

async function pullAll(deps: EngineDeps, result: SyncResult): Promise<void> {
  const { storage, adapter, key } = deps;
  const limit = deps.pullLimit ?? 1000;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const cursor = await storage.getCursor();
    const page = await adapter.pull(cursor, limit);

    if ((await storage.getEpoch()) !== page.epoch) {
      await adoptEpoch(deps, page.epoch, result);
      // The page was requested with a cursor of the old data set; start over unless it was a fresh start.
      if (cursor !== 0) continue;
    }

    let ops = page.ops;
    if (key) {
      const decrypted = await decryptOps(key, ops);
      result.rejected += decrypted.rejected;
      // Nothing decryptable in a non-empty page: wrong key (or a server that is not ours).
      if (ops.length > 0 && decrypted.ops.length === 0) throw new SyncError('decrypt');
      ops = decrypted.ops;
    } else if (ops.some((op) => isEncrypted(op.value))) {
      throw new SyncError('no-key');
    }

    const applied = await storage.applyRemote(ops);
    result.pulled += page.ops.length;
    result.applied += applied.applied;
    await storage.setCursor(page.cursor);
    if (!page.more) return;
  }
}

async function pushAll(deps: EngineDeps, result: SyncResult): Promise<void> {
  const { storage, adapter, key } = deps;
  const records = deps.pushRecords ?? 250;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const batch = await storage.readOutbox(records);
    if (batch.entries.length === 0) return;
    for (const chunk of chunkOps(batch.ops)) {
      const ops = key ? await encryptOps(key, chunk) : chunk;
      const { epoch } = await adapter.push(ops);
      if (epoch !== (await storage.getEpoch())) {
        await adoptEpoch(deps, epoch, result);
        throw new EpochChanged();
      }
    }
    // Only now: an interruption above leaves the entries queued and the next run pushes them again
    // (the server ignores ops it already has, so nothing is duplicated).
    await storage.acknowledge(batch.entries);
    result.pushed += batch.entries.length;
  }
}
