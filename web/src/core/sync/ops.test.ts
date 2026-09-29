import { describe, expect, it } from 'vitest';
import { mergeOps, recordToOps, type SyncRow } from './ops';
import type { FieldOp } from './types';

const h = (wall: number, counter = 0, dev = 'aaaa0001') =>
  `${String(wall).padStart(13, '0')}-${String(counter).padStart(4, '0')}-${dev}`;

const op = (field: string, hlc: string, value: unknown, id = 'r1'): FieldOp => ({
  collection: 'c',
  id,
  field,
  hlc,
  value,
});

const row = (): SyncRow => ({
  id: 'r1',
  createdAt: 1000,
  updatedAt: 2000,
  deviceId: 'aaaa0001',
  deletedAt: null,
  title: 'Milch',
  done: false,
  _f: { deletedAt: h(1000), title: h(1000), done: h(2000) },
});

describe('recordToOps', () => {
  it('emits every stamped field; removed fields and alive records are null', () => {
    const r = row();
    r._f.note = h(1500); // stamped but absent → removed
    expect(recordToOps('c', r)).toEqual([
      op('deletedAt', h(1000), null),
      op('title', h(1000), 'Milch'),
      op('done', h(2000), false),
      op('note', h(1500), null),
    ]);
  });

  it('a tombstone carries its timestamp as deletedAt value', () => {
    expect(
      recordToOps('c', { ...row(), deletedAt: 999 }).find((o) => o.field === 'deletedAt')?.value,
    ).toBe(999);
  });
});

describe('mergeOps', () => {
  it('rebuilds a record from its own ops (round trip) and derives the envelope from the stamps', () => {
    const { row: merged, changed } = mergeOps(undefined, 'r1', recordToOps('c', row()));
    expect(changed).toBe(true);
    expect(merged).toMatchObject({
      id: 'r1',
      title: 'Milch',
      done: false,
      deletedAt: null,
      _f: row()._f,
      updatedAt: 2000, // wall clock of the newest stamp
      deviceId: 'aaaa0001',
      createdAt: 1000, // wall clock of the oldest stamp
    });
  });

  it('newer ops win, older and equal ones do not; existing is never mutated', () => {
    const existing = row();
    const snapshot = structuredClone(existing);
    const { row: merged } = mergeOps(existing, 'r1', [
      op('title', h(3000, 0, 'bbbb0002'), 'Hafermilch'),
      op('done', h(1500), true), // older than h(2000)
      op('done', h(2000), true), // equal
    ]);
    expect(existing).toEqual(snapshot);
    expect(merged).toMatchObject({ title: 'Hafermilch', done: false });
    expect(merged.deviceId).toBe('bbbb0002');
    expect(merged.updatedAt).toBe(3000);
    expect(merged.createdAt).toBe(1000);
  });

  it('reports no change when nothing is newer', () => {
    const { changed, row: merged } = mergeOps(row(), 'r1', [op('title', h(500), 'x')]);
    expect(changed).toBe(false);
    expect(merged.title).toBe('Milch');
  });

  it('a newer null removes the field; a newer deletedAt turns it into a tombstone and back', () => {
    let { row: r } = mergeOps(row(), 'r1', [
      op('title', h(3000), null),
      op('deletedAt', h(3000), 5000),
    ]);
    expect('title' in r).toBe(false);
    expect(r.deletedAt).toBe(5000);
    ({ row: r } = mergeOps(r, 'r1', [op('deletedAt', h(4000), null)]));
    expect(r.deletedAt).toBeNull();
    expect(r._f.deletedAt).toBe(h(4000));
  });

  it('is order independent (convergence)', () => {
    const ops = [
      op('title', h(1000, 0, 'aaaa0001'), 'A'),
      op('title', h(1000, 0, 'bbbb0002'), 'B'),
      op('done', h(2000), true),
      op('title', h(900), 'old'),
    ];
    const forward = mergeOps(undefined, 'r1', ops).row;
    const backward = mergeOps(undefined, 'r1', [...ops].reverse()).row;
    expect(forward).toEqual(backward);
    expect(forward.title).toBe('B');
  });

  it('ignores reserved envelope fields, dangerous names, invalid stamps and non-numeric deletedAt', () => {
    const { row: r } = mergeOps(row(), 'r1', [
      op('id', h(9000), 'hacked'),
      op('_f', h(9000), {}),
      op('createdAt', h(9000), 1),
      op('updatedAt', h(9000), 1),
      op('deviceId', h(9000), 'x'),
      op('__proto__', h(9000), { polluted: true }),
      op('constructor', h(9000), 'x'),
      op('title', 'not-an-hlc', 'bad'),
      op('deletedAt', h(9000), 'yesterday'),
      op('', h(9000), 'empty'),
    ]);
    expect(r).toEqual(row());
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('keeps structured values as they are', () => {
    const { row: r } = mergeOps(undefined, 'r1', [
      op('recurrence', h(1), { freq: 'weekly', byWeekday: [1, 3] }),
    ]);
    expect(r.recurrence).toEqual({ freq: 'weekly', byWeekday: [1, 3] });
  });
});
