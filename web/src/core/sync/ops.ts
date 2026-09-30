/**
 * Pure conversion between stored records and field ops, and the merge rule itself:
 * per field the op with the greatest HLC wins, equal or older ops change nothing.
 * The server applies the identical rule in SQL (see contract/lww-cases.json).
 */
import { deepEqual } from '@/core/db/util';
import { ENVELOPE_KEYS, type SyncFields } from '@/core/db/types';
import type { FieldOp } from './types';

export type SyncRow = SyncFields & Record<string, unknown>;

const FORBIDDEN_FIELDS = new Set(['__proto__', 'constructor', 'prototype']);
const HLC_RE = /^\d{13}-\d{4}-[a-z0-9]{1,32}$/;
const reserved = new Set<string>(ENVELOPE_KEYS.filter((k) => k !== 'deletedAt'));

/** Every stamped field of a record as an op (data fields plus `deletedAt`). */
export function recordToOps(collection: string, row: SyncRow): FieldOp[] {
  return Object.entries(row._f).map(([field, hlc]) => ({
    collection,
    id: row.id,
    field,
    hlc,
    value: field === 'deletedAt' ? row.deletedAt : (row[field] ?? null),
  }));
}

const wallOf = (hlc: string): number => Number(hlc.slice(0, 13));
const deviceOf = (hlc: string): string => hlc.slice(19);

export interface MergeResult {
  row: SyncRow;
  changed: boolean;
}

/**
 * Applies remote ops for one record to its local state. Never mutates `existing`.
 * Invalid ops (bad HLC, reserved or dangerous field names, non-numeric deletedAt) are ignored.
 */
export function mergeOps(existing: SyncRow | undefined, id: string, ops: FieldOp[]): MergeResult {
  const row: SyncRow = existing
    ? { ...existing, _f: { ...existing._f } }
    : { id, createdAt: 0, updatedAt: 0, deviceId: '', deletedAt: null, _f: {} };
  let changed = false;

  for (const op of ops) {
    if (
      !HLC_RE.test(op.hlc) ||
      !op.field ||
      FORBIDDEN_FIELDS.has(op.field) ||
      reserved.has(op.field)
    ) {
      continue;
    }
    const current = row._f[op.field];
    if (current !== undefined && op.hlc <= current) continue;

    if (op.field === 'deletedAt') {
      if (op.value !== null && typeof op.value !== 'number') continue;
      row.deletedAt = op.value;
    } else if (op.value === null) {
      delete row[op.field];
    } else {
      row[op.field] = op.value;
    }
    row._f[op.field] = op.hlc;
    changed = true;
  }

  if (changed) {
    const stamps = Object.values(row._f).sort();
    const newest = stamps[stamps.length - 1]!;
    row.updatedAt = wallOf(newest);
    row.deviceId = deviceOf(newest);
    if (!existing) row.createdAt = wallOf(stamps[0]!);
  }
  return { row, changed };
}

export interface FieldConflict {
  field: string;
  /** Which side last-write-wins kept. */
  kept: 'local' | 'remote';
  keptValue: unknown;
  keptHlc: string;
  /** The value that was overwritten (local edit if `kept` is remote, remote edit if local). */
  lostValue: unknown;
  lostHlc: string;
}

const valueOf = (row: SyncRow, field: string): unknown =>
  field === 'deletedAt' ? row.deletedAt : (row[field] ?? null);

/**
 * Fields where an incoming op disagrees with the local value and last-write-wins picks one side.
 * Only meaningful for a record with unsynced local changes (the caller checks): then both sides
 * edited the field without seeing each other. Ops written by this device itself are ignored. Same validity rules as `mergeOps`.
 */
export function findConflicts(
  existing: SyncRow | undefined,
  ops: FieldOp[],
  ownDeviceId?: string,
): FieldConflict[] {
  if (!existing) return [];
  const out: FieldConflict[] = [];
  for (const op of ops) {
    if (
      !HLC_RE.test(op.hlc) ||
      !op.field ||
      FORBIDDEN_FIELDS.has(op.field) ||
      reserved.has(op.field)
    ) {
      continue;
    }
    const current = existing._f[op.field];
    if (current === undefined || op.hlc === current) continue;
    // Our own older edits come back from the server as echoes; they are not a second author.
    if (ownDeviceId && deviceOf(op.hlc) === ownDeviceId) continue;
    const local = valueOf(existing, op.field);
    if (deepEqual(local, op.value ?? null)) continue;
    out.push(
      op.hlc > current
        ? {
            field: op.field,
            kept: 'remote',
            keptValue: op.value ?? null,
            keptHlc: op.hlc,
            lostValue: local,
            lostHlc: current,
          }
        : {
            field: op.field,
            kept: 'local',
            keptValue: local,
            keptHlc: current,
            lostValue: op.value ?? null,
            lostHlc: op.hlc,
          },
    );
  }
  return out;
}
