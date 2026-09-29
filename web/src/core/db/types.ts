/** Envelope carried by every synchronised record. */
export interface SyncFields {
  id: string;
  createdAt: number;
  /** Wall-clock ms of the last change (display / coarse ordering). */
  updatedAt: number;
  /** Device that made the last change. */
  deviceId: string;
  /** Tombstone timestamp; null while the record is alive. */
  deletedAt: number | null;
  /** Per-field HLC stamps, the basis of field-level last-write-wins. */
  _f: Record<string, string>;
}

export type Stored<T> = T & SyncFields;

export const ENVELOPE_KEYS = [
  'id',
  'createdAt',
  'updatedAt',
  'deviceId',
  'deletedAt',
  '_f',
] as const;
