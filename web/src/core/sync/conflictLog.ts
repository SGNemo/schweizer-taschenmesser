/** Shape and construction of conflict log rows (no database access, so the storage adapter can use it). */
import type { FieldConflict } from './ops';

export type ConflictStatus = 'open' | 'restored' | 'dismissed';

export interface ConflictRow {
  id?: number;
  /** When it was detected (epoch ms). */
  at: number;
  collection: string;
  recordId: string;
  field: string;
  /** Which side last-write-wins kept. */
  kept: 'local' | 'remote';
  keptValue: unknown;
  /** The overwritten value; `null` with `truncated` when it was too large to keep. */
  lostValue: unknown;
  lostHlc: string;
  keptHlc: string;
  /** Device that wrote the remote side (from its HLC stamp). */
  remoteDevice: string;
  truncated?: boolean;
  status: ConflictStatus;
}

/** Values above this size are not stored (a note body could be huge). */
export const MAX_CONFLICT_VALUE_CHARS = 20_000;
export const RESOLVED_KEEP_MS = 30 * 24 * 3600_000;
export const OPEN_KEEP_MS = 90 * 24 * 3600_000;
export const MAX_CONFLICT_ROWS = 500;

const size = (v: unknown): number => JSON.stringify(v ?? null).length;

export function conflictRows(
  collection: string,
  recordId: string,
  conflicts: FieldConflict[],
  at: number,
): ConflictRow[] {
  return conflicts.map((c) => {
    const tooBig = size(c.lostValue) > MAX_CONFLICT_VALUE_CHARS;
    const remoteHlc = c.kept === 'remote' ? c.keptHlc : c.lostHlc;
    return {
      at,
      collection,
      recordId,
      field: c.field,
      kept: c.kept,
      keptValue: size(c.keptValue) > MAX_CONFLICT_VALUE_CHARS ? null : c.keptValue,
      lostValue: tooBig ? null : c.lostValue,
      lostHlc: c.lostHlc,
      keptHlc: c.keptHlc,
      remoteDevice: remoteHlc.slice(19),
      ...(tooBig ? { truncated: true } : {}),
      status: 'open' as const,
    };
  });
}
