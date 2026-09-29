import { SyncError, type FieldOp, type PullPage, type SyncAdapter } from '../types';

/**
 * Placeholder for the optional second sync backend (Google Drive, `appDataFolder`).
 * NOT IMPLEMENTED – it only documents how the SyncAdapter contract would map:
 *
 *  - push(ops): append the ops as one immutable JSON file per batch, named `<hlc-of-first-op>-<random>.json`
 *    (Drive has no atomic "greatest HLC wins" update; clients merge on read).
 *  - pull(since, limit): list files newer than the cursor (modifiedTime + name as a stable
 *    cursor), download them and return their ops. `epoch` is the id of a marker file that a reset replaces.
 *  - Encryption works unchanged (values are encrypted client-side before they reach the batch files).
 *  - Old batch files need compaction (merge into a snapshot) once they pile up.
 */
export class GoogleDriveAdapter implements SyncAdapter {
  readonly kind = 'googleDrive';

  push(_ops: FieldOp[]): Promise<{ epoch: string }> {
    return Promise.reject(new SyncError('unsupported', 'Google Drive sync is not implemented'));
  }

  pull(_since: number, _limit: number): Promise<PullPage> {
    return Promise.reject(new SyncError('unsupported', 'Google Drive sync is not implemented'));
  }
}
