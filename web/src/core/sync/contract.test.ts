import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeOps, type SyncRow } from './ops';
import type { FieldOp } from './types';

interface Case {
  name: string;
  batches: FieldOp[][];
  expected: Record<string, Record<string, { hlc: string; value: unknown }>>;
}

// Vitest runs with the web project as cwd; the fixtures live next to both projects.
const { cases } = JSON.parse(
  readFileSync(resolve(process.cwd(), '../contract/lww-cases.json'), 'utf8'),
) as {
  cases: Case[];
};

/** Applies batches to an in-memory "database" and reports winners as the server contract does. */
function finalState(batches: FieldOp[][]) {
  const rows = new Map<string, SyncRow>();
  for (const batch of batches) {
    const groups = new Map<string, FieldOp[]>();
    for (const op of batch)
      groups.set(`${op.collection}/${op.id}`, [
        ...(groups.get(`${op.collection}/${op.id}`) ?? []),
        op,
      ]);
    for (const [key, ops] of groups) rows.set(key, mergeOps(rows.get(key), ops[0]!.id, ops).row);
  }
  const state: Record<string, Record<string, { hlc: string; value: unknown }>> = {};
  for (const [key, row] of rows) {
    state[key] = Object.fromEntries(
      Object.entries(row._f).map(([field, hlc]) => [
        field,
        { hlc, value: field === 'deletedAt' ? row.deletedAt : (row[field] ?? null) },
      ]),
    );
  }
  return state;
}

describe('LWW contract (shared with the sync server)', () => {
  it('has cases', () => expect(cases.length).toBeGreaterThan(5));

  for (const c of cases) {
    it(c.name, () => {
      expect(finalState(c.batches)).toEqual(c.expected);
      expect(finalState([...c.batches].reverse().map((b) => [...b].reverse()))).toEqual(c.expected);
    });
  }
});
