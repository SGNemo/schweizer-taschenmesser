/** One field of one record with its HLC stamp – the unit that travels between devices. */
export interface FieldOp {
  /** Dexie table name, e.g. "todos_task". */
  collection: string;
  id: string;
  field: string;
  hlc: string;
  /** JSON value; `null` means "field removed". `deletedAt` is `null` while the record is alive. */
  value: unknown;
}

export interface PullPage {
  /** Identifies the remote data set; a different epoch means the remote was reset or replaced. */
  epoch: string;
  ops: FieldOp[];
  /** Pass as `since` for the next page. */
  cursor: number;
  more: boolean;
}

/**
 * Transport for field ops. Implementations are dumb stores ("greatest HLC per field wins"),
 * all merge logic lives in the client. The self-hosted server is the first implementation;
 * a Google Drive (appDataFolder) adapter is planned but not built (see googleDrive.stub.ts).
 */
export interface SyncAdapter {
  readonly kind: string;
  push(ops: FieldOp[]): Promise<{ epoch: string }>;
  pull(since: number, limit: number): Promise<PullPage>;
}

export type SyncErrorCode =
  | 'network'
  | 'unauthorized'
  /** This device was locked out from another device (its token was revoked). */
  | 'revoked'
  | 'rate-limited'
  | 'server'
  | 'decrypt'
  | 'no-key'
  | 'unsupported';

/** A device registered on the sync server. */
export interface DeviceInfo {
  id: string;
  name: string;
  createdAt: number;
  lastSeenAt: number | null;
  lastPushAt: number | null;
  lastPullAt: number | null;
  revokedAt: number | null;
  /** True for the device that asked. */
  current: boolean;
}

export interface ServerInfo {
  protocol: number;
  features: string[];
  role: 'admin' | 'device';
  deviceId: string | null;
}

export interface ServerStatus {
  epoch: string;
  fields: number;
  records: number;
  bytes: number;
  devices: number;
}

export class SyncError extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'SyncError';
  }
}
